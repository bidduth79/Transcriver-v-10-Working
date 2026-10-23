import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ history: [] as any[] }));
vi.mock('../../../services/db', () => ({ STORES: { HISTORY: 'studio_history' }, getAllFromStore: vi.fn(async () => m.history) }));

import { useTranscriberReportLogic } from './useTranscriberReportLogic';
import { useAppStore } from '@/hooks/useAppStore';

const h = (date: string, ext: string, dur: string, fileName = 'f.mp3') => ({ date, extension: ext, duration: dur, fileName });

const setup = async (isOpen = true) => {
  const hook = renderHook(({ o }) => useTranscriberReportLogic(o), { initialProps: { o: isOpen } });
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00'));
  m.history = [
    h('2026-10-03T10:00:00', 'mp3', '1:30'), h('2026-10-03T12:00:00', 'MP4', '1:00:00'), h('2026-10-03T13:00:00', 'wav', '0:30', 'http://yt/x'),
    h('2026-10-01T09:00:00', 'webm', '10:00'), h('2026-09-30T23:00:00', 'mp3', '5:00'), h('2026-10-20T08:00:00', '', 'bad'),
  ];
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useTranscriberReportLogic', () => {
  it('defaults to the current month and groups by day + file type', async () => {
    const { result } = await setup();
    expect([result.current.fromDate, result.current.toDate]).toEqual([
      new Date(2026, 9, 1).toISOString().split('T')[0], new Date(2026, 10, 0).toISOString().split('T')[0],
    ]);
    expect(result.current.reportData).toMatchSnapshot();
    // Existing behavior (bug kept as-is): the default range comes from toISOString(), so in UTC+6 it
    // runs from the last day of the previous month to the second-last day of this month.
    expect([result.current.totalQty, result.current.totalDurationSecs]).toEqual([6, 90 + 3600 + 30 + 600 + 300]);
    expect(result.current.formatSecondsToHrsMin(3725)).toBe('01 Hrs 02 Min');
    expect([result.current.ROWS_FIRST_PAGE, result.current.ROWS_OTHER_PAGES]).toEqual([24, 30]);
  });

  it('does not load while closed, reloads on open and store updates', async () => {
    const { result, rerender } = await setup(false);
    expect(result.current.reportData).toEqual([]);
    rerender({ o: true });
    await act(async () => {});
    expect(result.current.totalQty).toBe(6);
    m.history = [h('2026-10-05T10:00:00', 'mp3', '2:00')];
    await act(async () => { useAppStore.getState().triggerStoreUpdate('studio_history'); });
    expect(result.current.totalQty).toBe(1);
  });

  it('paginates 24 rows first, then 30 per page', async () => {
    m.history = Array.from({ length: 31 }, (_, i) => h(`2026-10-${String(i + 1).padStart(2, '0')}T10:00:00`, i % 2 ? 'mp4' : 'mp3', '1:00'));
    m.history.push(...Array.from({ length: 31 }, (_, i) => h(`2026-10-${String(i + 1).padStart(2, '0')}T11:00:00`, i % 2 ? 'mp3' : 'mp4', '1:00')));
    const { result } = await setup();
    expect(result.current.pages.map(p => p.length)).toEqual([24, 30, 6]);
    m.history = [];
    const empty = await setup();
    expect(empty.result.current.pages).toEqual([[]]);
  });

  it('exports a CSV with escaped cells and totals', async () => {
    const { result } = await setup();
    let blob: Blob | null = null; let name = '';
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => { blob = b; return 'blob:x'; }, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.getAttribute('download')!; });
    act(() => result.current.handleDownloadExcel());
    expect(name).toBe(`Report_${result.current.fromDate}_to_${result.current.toDate}.csv`);
    expect(await blob!.text()).toMatchSnapshot();
  });

  it('prints the report page HTML, or alerts when popups are blocked', async () => {
    const { result } = await setup();
    act(() => result.current.handleDownloadPDF());
    const el = document.createElement('div');
    el.id = 'report-content'; el.innerHTML = '<p>রিপোর্ট</p>';
    document.body.appendChild(el);
    let html = '';
    const win: any = { document: { write: (s: string) => { html += s; }, close: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValueOnce(win).mockReturnValueOnce(null);
    act(() => result.current.handleDownloadPDF());
    expect(html).toMatchSnapshot();
    expect(win.document.close).toHaveBeenCalled();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    act(() => result.current.handleDownloadPDF());
    expect(alertSpy.mock.calls[0][0].normalize('NFC')).toBe('পপ-আপ ব্লক করা আছে। দয়া করে ব্রাউজারের পপ-আপ অ্যালাউ করুন।'.normalize('NFC'));
    el.remove();
  });
});
