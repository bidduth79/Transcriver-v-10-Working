import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Header } from './Header';

const t = new Proxy({}, { get: (_, k) => `t.${String(k)}` }) as any;
const setup = (over: any = {}) => {
  const props: any = {
    t, status: 'idle', isSidebarOpen: false, setIsSidebarOpen: vi.fn(), isInformationOpen: false, setIsInformationOpen: vi.fn(),
    isActivityLogOpen: false, setIsActivityLogOpen: vi.fn(), isDark: true, setTheme: vi.fn(), appLang: 'bn', setAppLang: vi.fn(),
    activeColors: { primary: 'bg-p', text: 'text-p' }, setIsReportOpen: vi.fn(), setIsSettingsOpen: vi.fn(),
    transcriptionMode: 'pro', setTranscriptionMode: vi.fn(), ...over,
  };
  return { ...render(<Header {...props} />), props };
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
});

describe('Header', () => {
  it.each([
    ['default', {}],
    ['sidebar open, light, en, normal, processing', { isSidebarOpen: true, isDark: false, appLang: 'en', transcriptionMode: 'normal', status: 'processing' }],
    ['info and logs open', { isInformationOpen: true, isActivityLogOpen: true }],
  ])('renders %s', (_n, over) => {
    expect(setup(over).container.innerHTML).toMatchSnapshot();
  });

  it('toggles browser fullscreen and follows fullscreenchange', () => {
    const request = vi.fn(); const exit = vi.fn();
    (document.documentElement as any).requestFullscreen = request;
    (document as any).exitFullscreen = exit;
    const { container } = setup();
    const before = container.innerHTML;
    const fsButton = Array.from(container.querySelectorAll('button')).find(b => /t\.(fullScreen|exitFullScreen)/.test(b.getAttribute('title') || '')) as HTMLElement;
    fireEvent.click(fsButton);
    expect(request).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: document.body, configurable: true });
    act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
    expect(container.innerHTML).not.toBe(before);
    fireEvent.click(fsButton);
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    act(() => { document.dispatchEvent(new Event('fullscreenchange')); });
    expect(container.innerHTML).toBe(before);
  });

  it('wires every header button to its setter', () => {
    const { container, props } = setup();
    Array.from(container.querySelectorAll('button')).forEach(b => fireEvent.click(b));
    const called = Object.entries(props).filter(([, v]: any) => typeof v === 'function' && v.mock?.calls.length).map(([k]) => k).sort();
    expect(called).toMatchSnapshot();
  });
});
