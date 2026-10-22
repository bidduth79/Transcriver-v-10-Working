import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  actions: { report: '', loading: false, reportHistory: [] as any[] },
  load: vi.fn(), generate: vi.fn(), del: vi.fn(), analysis: { value: { matchCount: 2 } as any }, copy: vi.fn(async () => true),
}));
vi.mock('./hooks/useReportActions', () => ({
  useReportActions: () => ({ ...m.actions, loadReportsFromDB: m.load, generateReport: m.generate, handleDeleteReport: m.del }),
}));
vi.mock('./hooks/useReportAnalysis', () => ({ useReportAnalysis: () => m.analysis.value }));
vi.mock('../../utils/clipboard', () => ({ copyToClipboard: m.copy }));

import { ReportModal } from './ReportModal';
import { useAppStore } from '@/hooks/useAppStore';

const history = [
  { id: 'r1', searchTerm: 'মাদক', date: '2026-10-20T10:00:00Z', content: 'রিপোর্ট ১' },
  { id: 'r2', searchTerm: 'অস্ত্র', date: '2026-10-21T10:00:00Z', content: 'রিপোর্ট ২' },
];
const setup = (over: any = {}) => {
  const props = { isOpen: true, onClose: vi.fn(), transcript: 't', activeColors: { primary: 'bg-p' }, isDark: true, appLang: 'bn', fileMeta: {}, searchTerm: 'মাদক', addToast: vi.fn(), ...over };
  return { ...render(<ReportModal {...(props as any)} />), props };
};
const nfc = (s: string) => s.normalize('NFC');
const button = (c: HTMLElement, text: string) => Array.from(c.querySelectorAll('button')).find(b => nfc(b.textContent!.trim()) === nfc(text)) as HTMLElement;
const lastToast = (p: any) => { const c = p.addToast.mock.calls.at(-1); return [nfc(c[0]), c[1]]; };

beforeEach(() => {
  vi.clearAllMocks();
  m.actions = { report: '', loading: false, reportHistory: history };
  m.analysis.value = { matchCount: 2 };
  m.copy.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ReportModal markup', () => {
  it('renders nothing when closed', () => {
    expect(setup({ isOpen: false }).container.innerHTML).toBe('');
  });
  it.each([
    ['generate prompt (dark)', {}, {}],
    ['loading (light)', { loading: true }, { isDark: false }],
    ['generated report', { report: 'নতুন রিপোর্ট লেখা' }, {}],
    ['history (no matches) empty', { reportHistory: [] }, { noMatch: true }],
  ])('%s', (_n, actions: any, over: any) => {
    Object.assign(m.actions, actions);
    if (over.noMatch) m.analysis.value = { matchCount: 0 };
    expect(setup(over).container.innerHTML).toMatchSnapshot();
  });

  it('renders history with a selected report', () => {
    const { container } = setup();
    fireEvent.click(button(container, 'হিস্টোরি (2)'));
    fireEvent.click(container.querySelectorAll('.w-1\\/3 > div')[1]);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('ReportModal behavior', () => {
  it('loads on open, generates and switches tabs', async () => {
    const { container } = setup();
    expect(m.load).toHaveBeenCalled();
    fireEvent.click(button(container, 'জেনারেট রিপোর্ট'));
    expect(m.generate).toHaveBeenCalledWith({ matchCount: 2 });
    const before = m.load.mock.calls.length;
    await act(async () => { useAppStore.getState().triggerStoreUpdate('studio_reports'); });
    expect(m.load.mock.calls.length).toBeGreaterThan(before);
  });

  it('copies and downloads the current or selected report', async () => {
    m.actions.report = 'R';
    vi.spyOn(Date.prototype, 'getTime').mockReturnValue(111);
    const created: any[] = [];
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => { created.push(b); return 'blob:x'; }, revokeObjectURL: vi.fn() });
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });
    const { container, props } = setup();
    await act(async () => { fireEvent.click(button(container, 'কপি করুন')); });
    expect(m.copy).toHaveBeenCalledWith('R');
    expect(lastToast(props)).toEqual([nfc('কপি করা হয়েছে'), 'success']);
    m.copy.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.click(button(container, 'কপি করুন')); });
    expect(lastToast(props)).toEqual([nfc('কপি করতে সমস্যা হয়েছে'), 'error']);
    fireEvent.click(button(container, 'ডাউনলোড করুন'));
    expect(nfc(downloadName)).toBe(nfc('Report_মাদক_111.txt'));
    expect(await created[0].text()).toBe('R');
    expect(lastToast(props)).toEqual([nfc('ডাউনলোড শুরু হয়েছে'), 'success']);

    fireEvent.click(button(container, 'হিস্টোরি (2)'));
    fireEvent.click(container.querySelectorAll('.w-1\\/3 > div')[1]);
    await act(async () => { fireEvent.click(button(container, 'কপি করুন')); });
    expect(m.copy).toHaveBeenLastCalledWith('রিপোর্ট ২');
    fireEvent.click(button(container, 'ডাউনলোড করুন'));
    expect(nfc(downloadName)).toBe(nfc('Report_অস্ত্র_111.txt'));
  });

  it('deletes from history with the current selection', () => {
    const { container } = setup();
    fireEvent.click(button(container, 'হিস্টোরি (2)'));
    fireEvent.click(container.querySelectorAll('.w-1\\/3 > div')[0]);
    fireEvent.click(container.querySelectorAll('.w-1\\/3 > div')[1].querySelector('button')!);
    expect(m.del).toHaveBeenCalledWith('r2', history[0], expect.any(Function));
  });

  it('minimizes, maximizes and closes', () => {
    const { container, props } = setup();
    const [minBtn, maxBtn, closeBtn] = Array.from(container.querySelectorAll('header .flex.items-center.gap-2 button')) as HTMLElement[];
    fireEvent.click(minBtn);
    expect(container.innerHTML).toMatchSnapshot('minimized');
    fireEvent.click(maxBtn);
    expect((container.querySelector('#report-modal-container') as HTMLElement).style.width).toBe('100vw');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });
});
