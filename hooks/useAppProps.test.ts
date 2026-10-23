import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ loadAudio: vi.fn(async (..._a: any[]) => {}), setHistory: vi.fn() }));
vi.mock('../utils/audioUtils', () => ({ loadAudioFromStore: m.loadAudio }));
vi.mock('./history/useHistoryTranscript', () => ({ loadHistoryTranscript: async (id: string) => `SAVED:${id}` }));
vi.mock('./useHistoryStore', () => ({ useHistoryStore: { getState: () => ({ setHistory: m.setHistory }) } }));

import { getSidebarProps, getAppModalsProps, getExpandedHistoryProps, getTranscriptOutputProps } from './useAppProps';

// Fake core: every property is a distinct marker string, functions are spies
const makeCore = (over: any = {}) => {
  const fns = ['setIsSidebarOpen', 'handleFileChange', 'handleResetAll', 'handleTimeUpdate', 'processTranscription', 'setHistoryLimit', 'setIsHistoryFullscreen',
    'setShowFavoritesOnly', 'toggleFavorite', 'backupHistory', 'restoreHistory', 'setTranscript', 'setStatus', 'setTranscriptMeta', 'setActiveHistoryId',
    'setFile', 'setFileMeta', 'setFileUrl', 'setSearchTerm', 'startRecording', 'stopRecording', 'handleDeleteHistoryItem', 'setHistSentimentFilter'];
  const core: any = new Proxy({}, { get: (t: any, k: string) => (k in t ? t[k] : `core.${k}`) });
  fns.forEach(f => { core[f] = vi.fn(); });
  Object.assign(core, { isDark: true, history: [1, 2, 3], filteredHistory: [1], fileUrl: 'blob:x', transcriptMeta: null, fileMeta: 'FM', ...over });
  return core;
};
const shape = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'function' ? 'fn' : v]));
const item = { id: 'h1', fileName: 'a.mp3', duration: '1:00', channelName: 'C', publishedDate: 'P', transcript: 'TEXT', hasBeenOpened: false };

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe('prop builders', () => {
  it('map core fields for every container', () => {
    const core = makeCore();
    expect(shape(getSidebarProps(core))).toMatchSnapshot('sidebar');
    expect(shape(getAppModalsProps(core))).toMatchSnapshot('modals');
    expect(shape(getExpandedHistoryProps(core))).toMatchSnapshot('expanded');
    expect(shape(getTranscriptOutputProps(core))).toMatchSnapshot('transcript');
    expect(getSidebarProps(makeCore({ isDark: false })).bgColor).toBe('bg-white/80 backdrop-blur-xl');
    expect(getTranscriptOutputProps(makeCore({ transcriptMeta: 'TM' })).activeTranscriptSourceMeta).toBe('TM');
  });

  it('wires sidebar processTranscription and transcript search change', () => {
    const core = makeCore();
    getSidebarProps(core).processTranscription();
    expect(core.processTranscription).toHaveBeenCalledWith('core.file');
    const t = getTranscriptOutputProps(core);
    t.handleSearchChange({ target: { value: 'abc' } });
    t.handleSearchChange(undefined);
    expect(core.setSearchTerm.mock.calls).toEqual([['abc'], ['']]);
  });

  it('groups history by M/D/YYYY with an Unknown bucket', () => {
    const groups = getSidebarProps(makeCore()).groupHistory([
      { id: 1, date: '2026-03-05T10:00:00Z' }, { id: 2, date: '2026-03-05T23:00:00Z' }, { id: 3, date: 'October 22, 2026 10:00' },
      { id: 4, date: 'bad' }, { id: 5 }, null,
    ]);
    expect(Object.fromEntries(Object.entries(groups).map(([k, v]: any) => [k, v.map((i: any) => i?.id ?? null)]))).toEqual({
      '3/5/2026': [1, 2], '10/22/2026': [3], Unknown: [4, 5, null],
    });
    expect(getSidebarProps(makeCore()).groupHistory(undefined)).toEqual({});
  });
});

describe('loadHistoryItem', () => {
  it.each([['sidebar', getSidebarProps], ['expanded', getExpandedHistoryProps]])('%s: loads transcript, marks opened, loads audio and searches', async (name, build) => {
    const core = makeCore();
    await build(core).loadHistoryItem(item, 'মাদক');
    expect(core.setTranscript).toHaveBeenCalledWith('TEXT');
    expect(core.setStatus).toHaveBeenCalledWith('completed');
    expect(core.setTranscriptMeta).toHaveBeenCalledWith({ name: 'a.mp3', duration: '1:00', channelName: 'C', date: 'P' });
    expect(core.setActiveHistoryId).toHaveBeenCalledWith('h1');
    expect(core.setIsHistoryFullscreen.mock.calls).toEqual(name === 'expanded' ? [[false]] : []);
    const updater = m.setHistory.mock.calls[0][0];
    expect(updater([{ id: 'h1' }, { id: 'h2' }])).toEqual([{ id: 'h1', hasBeenOpened: true }, { id: 'h2' }]);
    expect(m.loadAudio).toHaveBeenCalledWith(item, core.setFile, core.setFileMeta, core.setFileUrl, core.setTranscriptMeta, 'blob:x');
    expect(core.setSearchTerm).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(core.setSearchTerm).toHaveBeenCalledWith('মাদক');
  });

  it('reads the transcript of a light list item from IndexedDB', async () => {
    const core = makeCore();
    await getSidebarProps(core).loadHistoryItem({ ...item, transcript: undefined });
    expect(core.setTranscript).toHaveBeenCalledWith('SAVED:h1');
  });

  it('skips marking already-opened items and search when no keyword', async () => {
    const core = makeCore({ fileUrl: null });
    await getSidebarProps(core).loadHistoryItem({ ...item, hasBeenOpened: true });
    expect(m.setHistory).not.toHaveBeenCalled();
    expect(m.loadAudio.mock.calls[0][5]).toBeUndefined();
    vi.advanceTimersByTime(500);
    expect(core.setSearchTerm).not.toHaveBeenCalled();
  });
});
