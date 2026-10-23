import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => (p: any) => require('react').createElement('div', { 'data-tab': name }, Object.keys(p).sort().join(',')),
}));
vi.mock('./QuotaMonitor', () => ({ QuotaMonitor: stub('quota') }));
vi.mock('./settings/SettingsApiKeys', () => ({ SettingsApiKeys: stub('keys') }));
vi.mock('./settings/SettingsKeywords', () => ({ SettingsKeywords: stub('keywords') }));
vi.mock('./settings/SettingsSync', () => ({ SettingsSync: stub('sync') }));
vi.mock('./settings/SettingsSystem', () => ({ SettingsSystem: stub('system') }));

import { SettingsModal } from './SettingsModal';

const setup = (over: any = {}) => {
  const props = { isOpen: true, onClose: vi.fn(), isDark: true, activeColors: { primary: 'bg-p' }, appLang: 'bn' as const, addToast: vi.fn(), ...over };
  return { ...render(<SettingsModal {...props} />), props };
};
const headerButtons = (c: HTMLElement) => Array.from(c.querySelectorAll('header button')) as HTMLElement[];
const box = (c: HTMLElement) => c.querySelector('#settings-modal-container') as HTMLElement;

beforeEach(() => vi.clearAllMocks());

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    expect(setup({ isOpen: false }).container.innerHTML).toBe('');
  });

  it.each([['dark bn', {}], ['light en', { isDark: false, appLang: 'en' }]])('renders the keys tab (%s)', (_n, over) => {
    expect(setup(over).container.innerHTML).toMatchSnapshot();
  });

  it('switches between all tabs', () => {
    const { container } = setup();
    const tabs = Array.from(container.querySelectorAll('nav button, .flex.border-b button, aside button')) as HTMLElement[];
    const shown: string[] = [];
    const buttons = tabs.length ? tabs : (Array.from(container.querySelectorAll('button')).filter(b => !b.closest('header')) as HTMLElement[]);
    buttons.forEach(b => { fireEvent.click(b); const t = container.querySelector('[data-tab]'); if (t) shown.push(t.getAttribute('data-tab')!); });
    expect([...new Set(shown)].sort()).toEqual(['keys', 'keywords', 'quota', 'sync', 'system']);
    expect(container.innerHTML).toMatchSnapshot('last tab');
  });

  it('minimizes to a widget, restores, maximizes and closes', () => {
    const { container, props } = setup();
    fireEvent.click(headerButtons(container)[0]);
    expect(box(container)).toBeNull();
    expect(container.innerHTML).toMatchSnapshot('minimized');
    fireEvent.click(container.querySelector('.cursor-pointer.hover\\:scale-105')!);
    expect(box(container)).not.toBeNull();
    fireEvent.click(headerButtons(container)[1]);
    expect([box(container).style.width, box(container).style.height]).toEqual(['100vw', '100vh']);
    fireEvent.click(headerButtons(container)[1]);
    expect(box(container).style.width).toBe('700px');
    fireEvent.click(headerButtons(container)[2]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('resizes from the corner handle with a 400px minimum', () => {
    const { container } = setup();
    vi.spyOn(box(container), 'getBoundingClientRect').mockReturnValue({ left: 50, top: 20 } as DOMRect);
    fireEvent.mouseDown(container.querySelector('.cursor-se-resize')!);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 950, clientY: 820 })); });
    expect([box(container).style.width, box(container).style.height]).toEqual(['900px', '800px']);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 })); });
    expect([box(container).style.width, box(container).style.height]).toEqual(['400px', '400px']);
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 950, clientY: 820 })); });
    expect(box(container).style.width).toBe('400px');
  });

  it('restores from minimized when reopened', () => {
    const { container, rerender, props } = setup();
    fireEvent.click(headerButtons(container)[0]);
    rerender(<SettingsModal {...props} isOpen={false} />);
    rerender(<SettingsModal {...props} isOpen />);
    expect(box(container)).not.toBeNull();
  });
});
