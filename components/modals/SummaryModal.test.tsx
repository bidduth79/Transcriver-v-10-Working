import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  saved: [] as any[], stats: null as any, ai: { value: null as any }, setAi: vi.fn(), analyzing: { value: false },
  props: {} as Record<string, any>, log: vi.fn(),
}));
vi.mock('../../services/SearchAnalysisHistory', () => ({
  getSearchAnalysisHistory: vi.fn(async () => [...m.saved]),
  saveSearchAnalysis: vi.fn(async (item: any) => { m.saved = [item, ...m.saved.filter(s => s.id !== item.id)]; return [...m.saved]; }),
  deleteSearchAnalysisAction: vi.fn(async (id: string) => { m.saved = m.saved.filter(s => s.id !== id); return [...m.saved]; }),
}));
vi.mock('../../services/SystemLogger', () => ({ logSystemActivity: m.log }));
vi.mock('./hooks/useSummaryLogic', () => ({
  useSummaryAnalysis: () => ({ aiAnalysis: m.ai.value, setAiAnalysis: m.setAi, isAnalyzing: m.analyzing.value, performAIAnalysis: vi.fn() }),
  useSummaryStats: () => m.stats,
}));
vi.mock('./summary/SummaryLiveReport', () => ({
  SummaryLiveReport: (p: any) => { m.props.live = p; return React.createElement('div', { 'data-live': p.titleSuffix }, `${p.data.fileName}|${p.viewMode}`); },
}));
vi.mock('./summary/SummaryHistoryList', () => ({
  SummaryHistoryList: (p: any) => { m.props.list = p; return React.createElement('div', { 'data-list': true }, p.historyWithDuplicateFlags.map((h: any) => `${h.id}:${h.isDuplicate}`).join(',')); },
}));

import { SummaryModal } from './SummaryModal';
import { getSearchAnalysisHistory, saveSearchAnalysis } from '../../services/SearchAnalysisHistory';
import { useAppStore } from '@/hooks/useAppStore';

const stats = { searchTerm: 'মাদক', fileName: 'a.mp3', duration: '1:00', matchCount: 2, matchTimestamps: ['00:01'], matchSentences: ['s'] };
const item = (id: string, over: any = {}) => ({ id, searchTerm: 'x', fileName: `f${id}`, duration: '', speakerCount: 0, matchCount: 1, matchTimestamps: [], matchSentences: [], date: '2026-01-01', sentiment: 'pending', remarkExplanation: '', ...over });

const renderModal = async (over: any = {}) => {
  const props = { isOpen: true, onClose: vi.fn(), transcript: 'text', activeColors: { primary: 'bg-p' }, isDark: true, appLang: 'bn', searchTerm: 'মাদক', matchCount: 2, fileMeta: {}, addToast: vi.fn(), ...over };
  let u: any;
  await act(async () => { u = render(<SummaryModal {...(props as any)} />); });
  return { ...(u as ReturnType<typeof render>), props };
};
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.clearAllMocks();
  m.saved = []; m.stats = stats; m.ai.value = null; m.analyzing.value = false; m.props = {};
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('SummaryModal markup', () => {
  it('renders nothing when closed', async () => {
    expect((await renderModal({ isOpen: false })).container.innerHTML).toBe('');
  });
  it('renders live report (dark)', async () => {
    expect((await renderModal()).container.innerHTML).toMatchSnapshot();
  });
  it('renders "no match" state (light)', async () => {
    m.stats = { ...stats, matchCount: 0 };
    expect((await renderModal({ isDark: false })).container.innerHTML).toMatchSnapshot();
  });
  it('opens on history when there is no search term, flagging duplicates', async () => {
    m.saved = [item('1', { fileName: 'same' }), item('2', { fileName: 'other' }), item('3', { fileName: 'same' })];
    const { container } = await renderModal({ searchTerm: '' });
    expect(container.querySelector('[data-list]')?.textContent).toBe('1:false,2:false,3:true');
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('SummaryModal behavior', () => {
  it('auto-saves new live results after 500ms, but not duplicates', async () => {
    await renderModal();
    expect(m.setAi).toHaveBeenCalledWith(null);
    await flush(499);
    expect(saveSearchAnalysis).not.toHaveBeenCalled();
    await flush(1);
    expect(saveSearchAnalysis).toHaveBeenCalledWith(expect.objectContaining({ id: String(Date.now()), searchTerm: 'মাদক', fileName: 'a.mp3', matchCount: 2, sentiment: 'pending', remarkExplanation: '' }));
    vi.clearAllMocks();
    await renderModal();
    await flush(500);
    expect(saveSearchAnalysis).not.toHaveBeenCalled();
  });

  it('updates the pending saved entry when AI analysis arrives', async () => {
    m.saved = [item('old', { searchTerm: 'মাদক', fileName: 'a.mp3', matchCount: 2, date: 'D0' })];
    m.ai.value = { sentiment: 'Negative', remark: 'R' };
    await renderModal();
    await flush(0);
    expect(saveSearchAnalysis).toHaveBeenCalledWith(expect.objectContaining({ id: 'old', date: 'D0', sentiment: 'Negative', remarkExplanation: 'R' }));
  });

  it('switches tabs, opens archived items and deletes', async () => {
    m.saved = [item('1')];
    const { getByText, container, props } = await renderModal();
    fireEvent.click(getByText('হিস্টোরি আর্কাইভ'));
    expect(container.querySelector('[data-list]')).toBeTruthy();
    act(() => m.props.list.onSelect(m.saved[0]));
    expect(container.querySelector('[data-live]')?.getAttribute('data-live')).toBe('ARCHIVED ANALYSIS');
    fireEvent.click(getByText('লাইভ রিপোর্ট'));
    expect(container.querySelector('[data-live]')?.getAttribute('data-live')).toBe('LIVE ANALYSIS');
    fireEvent.click(getByText('হিস্টোরি আর্কাইভ'));
    const ev = { stopPropagation: vi.fn() };
    await act(async () => { await m.props.list.onDelete(ev, '1'); });
    expect(ev.stopPropagation).toHaveBeenCalled();
    expect(container.querySelector('[data-list]')?.textContent).toBe('');
    expect(m.log).toHaveBeenCalledWith('ANALYSIS', 'WARNING', 'Analysis Deleted', 'ID: 1');
    expect((props.addToast as any).mock.calls.at(-1)[0].normalize('NFC')).toBe('ডিলিট করা হয়েছে'.normalize('NFC'));
  });

  it('minimizes, maximizes, closes and reloads on store updates', async () => {
    const { container, props } = await renderModal();
    const [minBtn, maxBtn, closeBtn] = Array.from(container.querySelectorAll('header button')).slice(2) as HTMLElement[];
    fireEvent.click(minBtn);
    expect(container.innerHTML).toMatchSnapshot('minimized');
    fireEvent.click(maxBtn);
    expect((container.querySelector('#summary-modal-container') as HTMLElement).style.width).toBe('100vw');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
    const before = (getSearchAnalysisHistory as any).mock.calls.length;
    await act(async () => { useAppStore.getState().triggerStoreUpdate('studio_analysis'); });
    expect((getSearchAnalysisHistory as any).mock.calls.length).toBe(before + 1);
  });
});
