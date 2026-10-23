import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  props: {} as Record<string, any>,
  sensitive: { isSensitive: false },
  db: new Map<string, any>(),
  addToStore: vi.fn(async (_s: string, item: any) => { m.db.set(item.id, item); }),
}));

// Child stub: records its props and renders a readable summary of them
const { stub } = vi.hoisted(() => {
  const summarize = (props: any) => Object.fromEntries(Object.entries(props).sort().map(([k, v]: any) =>
    [k, typeof v === 'function' ? 'fn' : v && typeof v === 'object' ? ('current' in v ? 'ref' : Array.isArray(v) ? `arr(${v.length})` : 'obj') : v]));
  const stub = (name: string) => (props: any) => {
    m.props[name] = props;
    return React.createElement('div', { 'data-c': name }, JSON.stringify(summarize(props)));
  };
  return { stub };
});

vi.mock('./components/TranscriptModals', () => ({ TranscriptModals: stub('TranscriptModals') }));
vi.mock('./components/TranscriptContent', () => ({ TranscriptContent: stub('TranscriptContent') }));
vi.mock('./ProcessingView.tsx', () => ({ ProcessingView: stub('ProcessingView') }));
vi.mock('./components/TranscriptSidebarTools', () => ({ TranscriptSidebarTools: stub('TranscriptSidebarTools') }));
vi.mock('./components/TranscriptScrollControls', () => ({ TranscriptScrollControls: stub('TranscriptScrollControls') }));
vi.mock('./components/TranscriptIdleView', () => ({ TranscriptIdleView: stub('TranscriptIdleView') }));
vi.mock('./components/TranscriptErrorView', () => ({ TranscriptErrorView: stub('TranscriptErrorView') }));
vi.mock('./TranscriptToolbar', () => ({ TranscriptToolbar: stub('TranscriptToolbar') }));
vi.mock('./TranscriptViewer', () => ({
  FormattedTranscript: stub('FormattedTranscript'),
  escapeRegExp: (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
}));
vi.mock('./hooks/useTranscriptOutput', () => ({
  useTranscriptScroll: () => ({ scrollContainerRef: { current: null }, transcriptEndRef: { current: null }, localScrollPercent: 42, handleScroll: vi.fn(), scrollToTop: vi.fn(), scrollToBottom: vi.fn() }),
  useLogoAnimation: () => ({ logoOffset: { x: 1, y: 2 }, logoContainerRef: { current: null }, handleLogoMouseMove: vi.fn(), handleLogoMouseLeave: vi.fn() }),
  useSensitiveKeywords: () => ({ sensitiveMatches: ['মাদক'], sensitiveWordCounts: { 'মাদক': 2 }, isSensitive: m.sensitive.isSensitive }),
}));
vi.mock('./hooks/useBgbAnalysis', () => ({
  useBgbAnalysis: () => ({ isBgbAnalysisEnabled: true, setIsBgbAnalysisEnabled: vi.fn(), bgbAnalysisResult: null, isAnalyzing: false, triggerAnalysis: vi.fn() }),
}));
vi.mock('../../hooks/useSpeakerProfile', () => ({
  useSpeakerProfile: () => ({ isOpen: false, speakerName: 'S1', profile: null, isLoading: false, error: null, openProfile: vi.fn(), closeProfile: vi.fn(), refreshProfile: vi.fn(), updateCustomNote: vi.fn() }),
}));
vi.mock('../../services/db', () => ({
  STORES: { HISTORY: 'studio_history' },
  getFromStore: vi.fn(async (_s: string, id: string) => m.db.get(id)),
  addToStore: m.addToStore,
}));

import { TranscriptOutput } from './TranscriptOutput';

// Matches Bengali text regardless of Unicode composition ("য়" may be encoded differently)
const bn = (expected: string) => ({ asymmetricMatch: (a: any) => typeof a === 'string' && a.normalize('NFC') === expected.normalize('NFC'), toString: () => expected });

const makeProps = (over: any = {}) => ({
  t: { processingHeader: 'PROCESSING' }, status: 'completed', transcriptSearchInputRef: { current: { focus: vi.fn() } },
  searchTerm: '', handleSearchChange: vi.fn(), activeColors: { primary: 'bg-p' }, setStatus: vi.fn(), setTranscript: vi.fn(),
  mainBgColor: 'bg-main', fileUrl: 'blob:a', textColor: 'text-x', isDark: true, setIsSidebarOpen: vi.fn(),
  fileMeta: { name: 'a.mp3' }, processTranscription: vi.fn(), cardBorder: 'b', transcript: '**Speaker 1:** হ্যালো। **Speaker 1:** আবার',
  fontSize: 16, setFontSize: vi.fn(), matchCount: 3, currentMatchIndex: 1, goToNextMatch: vi.fn(), goToPrevMatch: vi.fn(),
  errorMessage: 'ERR', transformTranscript: vi.fn(), transformingType: null, addToast: vi.fn(), appLang: 'bn', history: [],
  onSeek: vi.fn(), onModelUpdate: vi.fn(), setIsAiLoading: vi.fn(), audioCurrentTime: 5, activeTranscriptSourceMeta: { name: 'a.mp3' },
  progress: 40, currentStage: 'STAGE', elapsedSeconds: 3, estimatedSeconds: 9, setActiveHistoryId: vi.fn(),
  activeHistoryId: null, setTranscriptMeta: vi.fn(), audioRef: { current: null }, ...over,
});
const setup = (over: any = {}) => {
  const props = makeProps(over);
  return { ...render(<TranscriptOutput {...(props as any)} />), props };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.props = {};
  m.sensitive.isSensitive = false;
  m.db.clear();
});

describe('TranscriptOutput markup by state', () => {
  it.each([
    ['idle', { status: 'idle', transcript: '' }],
    ['completed empty', { status: 'completed', transcript: '' }],
    ['processing empty', { status: 'processing', transcript: '' }],
    ['processing streaming', { status: 'processing' }],
    ['completed dark', {}],
    ['completed light sensitive', { isDark: false, sensitive: true }],
    ['completed dark sensitive transforming', { sensitive: true, transformingType: 'summary', appLang: 'en' }],
    ['error', { status: 'error', transcript: '' }],
  ])('%s', (_name, over: any) => {
    m.sensitive.isSensitive = !!over.sensitive;
    const { container } = setup(over);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('TranscriptOutput behavior', () => {
  it('names downloads after the shown transcript (history item without audio), else the file', () => {
    setup({ fileMeta: null, activeTranscriptSourceMeta: { name: 'old-call.mp3' } });
    expect(m.props.TranscriptToolbar.fileMeta.name).toBe('old-call.mp3');
    setup({ activeTranscriptSourceMeta: null });
    expect(m.props.TranscriptToolbar.fileMeta.name).toBe('a.mp3');
  });

  it('Try Again resets transcript, status, active history and meta', () => {
    const { getByText, props } = setup();
    fireEvent.click(getByText(/নতুন করে চেষ্টা করুন/));
    expect(props.setTranscript).toHaveBeenCalledWith('');
    expect(props.setStatus).toHaveBeenCalledWith('idle');
    expect(props.setActiveHistoryId).toHaveBeenCalledWith(null);
    expect(props.setTranscriptMeta).toHaveBeenCalledWith(null);
  });

  it('wires toolbar search helpers and summary modal', () => {
    const { props } = setup({ searchTerm: 'x' });
    const tb = m.props.TranscriptToolbar;
    expect(tb.isDisabled).toBe(false);
    const ev = { key: 'Enter', preventDefault: vi.fn() };
    tb.handleKeyDown(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(props.goToNextMatch).toHaveBeenCalledTimes(1);
    tb.handleKeyDown({ key: 'a', preventDefault: vi.fn() });
    expect(props.goToNextMatch).toHaveBeenCalledTimes(1);
    tb.clearSearch();
    expect(props.handleSearchChange).toHaveBeenCalledWith({ target: { value: '' } });
    expect(props.transcriptSearchInputRef.current.focus).toHaveBeenCalled();
    expect(m.props.TranscriptModals.isSummaryOpen).toBe(false);
    act(() => tb.handleSummaryClick());
    expect(m.props.TranscriptModals.isSummaryOpen).toBe(true);
    act(() => tb.setIsReportOpen(true));
    expect(m.props.TranscriptModals.isReportOpen).toBe(true);
    expect(m.props.TranscriptModals.isAnalysisOpen).toBe(false);
    act(() => tb.setIsAnalysisOpen(true));
    expect(m.props.TranscriptModals.isAnalysisOpen).toBe(true);
    act(() => m.props.TranscriptModals.setIsSummaryOpen(false));
    expect(m.props.TranscriptModals).toMatchObject({ isSummaryOpen: false, isReportOpen: true, isAnalysisOpen: true });
  });

  it('renames a speaker in the transcript and saved history', async () => {
    m.db.set('h1', { id: 'h1', transcript: 'old' });
    vi.spyOn(window, 'prompt').mockReturnValue('রহিম');
    const { props } = setup({ activeHistoryId: 'h1' });
    await act(async () => { await m.props.TranscriptContent.onRenameSpeaker('Speaker 1'); });
    const expected = '**রহিম:** হ্যালো। **রহিম:** আবার';
    expect(props.setTranscript).toHaveBeenCalledWith(expected);
    expect(props.addToast).toHaveBeenCalledWith(bn('স্পীকারের নাম পরিবর্তন করা হয়েছে'), 'success');
    expect(m.db.get('h1').transcript).toBe(expected);
  });

  it('ignores cancelled or unchanged rename', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('Speaker 1').mockReturnValueOnce('  ');
    const { props } = setup();
    for (let i = 0; i < 3; i++) await act(async () => { await m.props.TranscriptContent.onRenameSpeaker('Speaker 1'); });
    expect(props.setTranscript).not.toHaveBeenCalled();
    expect(m.addToStore).not.toHaveBeenCalled();
  });
});
