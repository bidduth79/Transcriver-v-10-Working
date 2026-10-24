import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ShortcutModal } from './ShortcutModal';
import { getSavedShortcuts, saveShortcut } from '../../services/ShortcutConfig';
import { uiText } from '../../utils/uiText';

const OK = uiText('bn', 'ok');
const CANCEL = uiText('bn', 'cancel');
const setup = (over: any = {}) => {
  const props = { isOpen: true, onClose: vi.fn(), isDark: true, activeColors: { primary: 'bg-p' }, appLang: 'bn' as const, ...over };
  return { ...render(<ShortcutModal {...props} />), props };
};
const keyOf = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll('.grid.md\\:grid-cols-2 > div')).find(d => d.querySelector('p')!.textContent === label)!.querySelector('kbd')!.textContent!.trim();
const editRow = (c: HTMLElement, label: string) =>
  (Array.from(c.querySelectorAll('.grid.md\\:grid-cols-2 > div')).find(d => d.querySelector('p')!.textContent === label)!.querySelector('button[title="Edit Shortcut"]') as HTMLElement);
const capture = (c: HTMLElement) => c.querySelector('input[readonly]') as HTMLElement;

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
afterEach(() => vi.restoreAllMocks());

describe('ShortcutModal markup', () => {
  it('renders nothing when closed', () => {
    expect(setup({ isOpen: false }).container.innerHTML).toBe('');
  });
  it('renders the cheat sheet (dark) with a customized key', () => {
    saveShortcut('ui.theme', 'Ctrl+Shift+D');
    expect(setup().container.innerHTML).toMatchSnapshot();
  });
  it('renders the customize tab (light) and the capture overlay', () => {
    const { container, getByText } = setup({ isDark: false });
    fireEvent.click(getByText('Customize'));
    expect(container.innerHTML).toMatchSnapshot('customize');
    fireEvent.click(editRow(container, 'File Upload'));
    expect(container.innerHTML).toMatchSnapshot('capture overlay');
  });
});

describe('ShortcutModal behavior', () => {
  it('filters by label, description and current key', () => {
    saveShortcut('file.upload', 'Alt+Q');
    const { container } = setup();
    const search = container.querySelector('input[placeholder="Search shortcuts..."]') as HTMLInputElement;
    const labels = () => Array.from(container.querySelectorAll('.grid.md\\:grid-cols-2 p.text-xs')).map(p => p.textContent);
    fireEvent.change(search, { target: { value: 'volume' } });
    expect(labels()).toEqual(['Volume Up', 'Volume Down']);
    fireEvent.change(search, { target: { value: 'alt+q' } });
    expect(labels()).toEqual(['File Upload']);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(labels()).toEqual([]);
  });

  it('captures key combos, ignores lone modifiers and saves', () => {
    const { container, getByText } = setup();
    fireEvent.click(getByText('Customize'));
    fireEvent.click(editRow(container, 'File Upload'));
    fireEvent.keyDown(capture(container), { key: 'Shift', shiftKey: true });
    expect(capture(container)).toBeTruthy();
    fireEvent.keyDown(capture(container), { key: 'k', ctrlKey: true, shiftKey: true, altKey: true, metaKey: true });
    expect(keyOf(container, 'File Upload')).toBe('Ctrl+Shift+Alt+Meta+K');
    expect(getSavedShortcuts()['file.upload']).toBe('Ctrl+Shift+Alt+Meta+K');
    expect(capture(container)).toBeNull();
    // Space is Play/Pause's default, so saving it asks (in the app's own dialog) to overwrite
    fireEvent.click(editRow(container, 'File Upload'));
    fireEvent.keyDown(capture(container), { key: ' ' });
    expect(getByText('Shortcut "Space" is already used by "Play / Pause". Overwrite?')).toBeTruthy();
    fireEvent.click(getByText(OK));
    expect(keyOf(container, 'File Upload')).toBe('Space');
  });

  it('asks before overwriting a conflicting shortcut', () => {
    const { container, getByText } = setup();
    fireEvent.click(getByText('Customize'));
    fireEvent.click(editRow(container, 'File Upload'));
    fireEvent.keyDown(capture(container), { key: 'd', ctrlKey: true });
    expect(getByText('Shortcut "Ctrl+D" is already used by "Day/Night Mode". Overwrite?')).toBeTruthy();
    expect(capture(container)).toBeNull();
    fireEvent.click(getByText(CANCEL));
    expect(keyOf(container, 'File Upload')).toBe('Ctrl+U');
    fireEvent.keyDown(capture(container), { key: 'd', ctrlKey: true });
    fireEvent.click(getByText(OK));
    expect(keyOf(container, 'File Upload')).toBe('Ctrl+D');
  });

  it('resets defaults after confirmation, cancels capture and closes', () => {
    saveShortcut('file.upload', 'Alt+Q');
    const { container, getByText, props } = setup();
    fireEvent.click(getByText('Customize'));
    fireEvent.click(getByText('Reset Defaults'));
    fireEvent.click(getByText(CANCEL));
    expect(keyOf(container, 'File Upload')).toBe('Alt+Q');
    fireEvent.click(getByText('Reset Defaults'));
    fireEvent.click(getByText(OK));
    expect(keyOf(container, 'File Upload')).toBe('Ctrl+U');
    expect(getSavedShortcuts()).toEqual({});
    fireEvent.click(editRow(container, 'File Upload'));
    fireEvent.click(getByText('Cancel'));
    expect(capture(container)).toBeNull();
    fireEvent.click(editRow(container, 'File Upload'));
    fireEvent.mouseDown(container.querySelector('.fixed.inset-0.z-\\[210\\]')!);
    fireEvent.click(container.querySelector('.fixed.inset-0.z-\\[210\\]')!);
    expect(capture(container)).toBeNull();
    fireEvent.click(container.querySelector('.px-8.py-6 button')!);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('reloads saved keys and clears search when reopened', () => {
    const { container, rerender, props } = setup();
    fireEvent.change(container.querySelector('input[placeholder="Search shortcuts..."]')!, { target: { value: 'volume' } });
    rerender(<ShortcutModal {...props} isOpen={false} />);
    saveShortcut('ui.theme', 'Alt+T');
    rerender(<ShortcutModal {...props} isOpen />);
    expect((container.querySelector('input[placeholder="Search shortcuts..."]') as HTMLInputElement).value).toBe('');
    expect(keyOf(container, 'Day/Night Mode')).toBe('Alt+T');
  });
});
