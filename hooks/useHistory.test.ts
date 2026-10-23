import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ store: new Map<string, any>(), pull: vi.fn(), broadcast: vi.fn() }));
vi.mock('../services/db', () => ({
  STORES: { HISTORY: 'studio_history', YOUTUBE_AUDIO: 'youtube_audio' },
  getAllFromStore: vi.fn(async () => [...m.store.values()]),
  getFromStore: vi.fn(async (_s: string, id: string) => m.store.get(id)),
  // IndexedDB stand-in for services/historyRecords: a cursor over the stored records
  initDB: vi.fn(async () => ({ transaction: () => ({ objectStore: () => ({ openCursor: () => {
    const req: any = {}; const values = [...m.store.values()]; let i = 0;
    const step = () => queueMicrotask(() => { req.result = i < values.length ? { value: values[i], continue: () => { i++; step(); } } : null; req.onsuccess(); });
    step(); return req;
  } }) }) })),
  addToStore: vi.fn(async (_s: string, item: any) => { m.store.set(item.id, item); }),
  deleteFromStore: vi.fn(async (_s: string, id: string) => { m.store.delete(id); }),
}));
vi.mock('./useBroadcastSync', () => ({ useBroadcastSync: vi.fn(), broadcastHistoryUpdate: m.broadcast }));
vi.mock('../services/firebaseThrottledQueue', () => ({ scheduleGentleFirebasePull: m.pull }));

import { useHistory } from './useHistory';
import { useHistoryStore } from './useHistoryStore';
import { deleteFromStore } from '../services/db';

const items = [
  { id: 'a', fileName: 'news_clip#1.mp3', date: '2026-10-20T10:00:00Z', transcript: 'সীমান্তে মাদক', bgbRemark: 'Negative', duration: '1:00' },
  { id: 'b', fileName: 'talk.mp3', date: '2026-10-22T10:00:00Z', transcript: 'hello', isFavorite: true, duration: '2:00' },
  { id: 'c', fileName: 'other.wav', date: '2026-10-21T10:00:00Z', text: 'legacy text field', bgbRemark: 'Positive' },
];
const nfc = (s: string) => s.normalize('NFC');

const setup = async (lang: 'bn' | 'en' = 'en') => {
  const addToast = vi.fn(); const onDeleted = vi.fn();
  const hook = renderHook(() => useHistory(lang, addToast, onDeleted));
  await act(async () => { await hook.result.current.loadHistory(); });
  return { ...hook, addToast, onDeleted };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.store = new Map(items.map(i => [i.id, { ...i }]));
  useHistoryStore.setState({ history: [], activeHistoryId: null, histSearch: '', debouncedHistSearch: '', histDateFilter: '', histSentimentFilter: 'All', showFavoritesOnly: false });
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-23T09:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('useHistory', () => {
  it('loads newest first, caches a light copy and schedules the Firebase pull', async () => {
    const { result } = await setup();
    expect(result.current.history.map(h => h.id)).toEqual(['b', 'c', 'a']);
    // Transcripts stay in IndexedDB, not in the in-memory list
    expect(result.current.history.some(h => 'transcript' in h || 'text' in h)).toBe(false);
    act(() => { vi.advanceTimersByTime(0); });
    expect(JSON.parse(sessionStorage.getItem('historyCache')!)[0]).toEqual({ id: 'b', fileName: 'talk.mp3', date: '2026-10-22T10:00:00Z', duration: '2:00', isFavorite: true });
    expect(m.pull).toHaveBeenCalledWith(expect.any(Function), false);
  });

  it('filters by debounced search, date, favorites and sentiment', async () => {
    const { result } = await setup();
    const ids = () => result.current.filteredHistory.map(h => h.id);
    const scanTranscripts = () => act(async () => { await vi.advanceTimersByTimeAsync(1); });
    act(() => result.current.setHistSearch('news clip'));
    expect(ids()).toEqual(['b', 'c', 'a']);
    act(() => { vi.advanceTimersByTime(400); });
    expect(ids()).toEqual(['a']);
    act(() => result.current.setHistSearch('legacy'));
    act(() => { vi.advanceTimersByTime(400); });
    expect(ids()).toEqual([]);
    await scanTranscripts();
    expect(ids()).toEqual(['c']);
    act(() => result.current.setHistSearch('মাদক'));
    act(() => { vi.advanceTimersByTime(400); });
    await scanTranscripts();
    expect(ids()).toEqual(['a']);
    // Regex characters are matched literally
    act(() => result.current.setHistSearch('clip#1.mp3 ('));
    act(() => { vi.advanceTimersByTime(400); });
    expect(ids()).toEqual([]);
    act(() => result.current.setHistSearch('clip#1.mp3'));
    act(() => { vi.advanceTimersByTime(400); });
    expect(ids()).toEqual(['a']);
    act(() => result.current.setHistSearch(''));
    act(() => { vi.advanceTimersByTime(400); });
    act(() => result.current.setHistDateFilter('2026-10-21'));
    expect(ids()).toEqual(['c']);
    act(() => { result.current.setHistDateFilter(''); result.current.setShowFavoritesOnly(true); });
    expect(ids()).toEqual(['b']);
    act(() => { result.current.setShowFavoritesOnly(false); result.current.setHistSentimentFilter('Negative'); });
    expect(ids()).toEqual(['a']);
  });

  it('deletes optimistically, clears the active item and removes stored data', async () => {
    const { result, addToast, onDeleted } = await setup('bn');
    act(() => result.current.setActiveHistoryId('a'));
    await act(async () => { await result.current.handleDeleteHistoryItem('a'); });
    expect(result.current.history.map(h => h.id)).toEqual(['b', 'c']);
    expect(result.current.activeHistoryId).toBeNull();
    expect(onDeleted).toHaveBeenCalledWith('a');
    expect([nfc(addToast.mock.calls[0][0]), addToast.mock.calls[0][1]]).toEqual([nfc('ডিলিট করা হয়েছে'), 'warning']);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect((deleteFromStore as any).mock.calls).toEqual([['studio_history', 'a'], ['youtube_audio', 'a']]);
    expect(m.broadcast).toHaveBeenCalled();
    await act(async () => { await result.current.handleDeleteHistoryItem('b'); });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('toggles favorites and persists', async () => {
    const { result, addToast } = await setup();
    await act(async () => { await result.current.toggleFavorite('a'); });
    expect(result.current.history.find(h => h.id === 'a')?.isFavorite).toBe(true);
    expect(m.store.get('a').isFavorite).toBe(true);
    expect(m.store.get('a').transcript).toBe(items[0].transcript);
    await act(async () => { await result.current.toggleFavorite('a'); });
    expect(addToast.mock.calls.map(c => c[0])).toEqual(['Added to favorites', 'Removed from favorites']);
    await act(async () => { await result.current.toggleFavorite('zzz'); });
    expect(addToast).toHaveBeenCalledTimes(2);
  });

  it('backs up history as dated JSON and restores valid items', async () => {
    const { result, addToast } = await setup();
    let blob: Blob | null = null; let name = '';
    vi.stubGlobal('URL', { createObjectURL: (b: Blob) => { blob = b; return 'blob:x'; }, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.getAttribute('download')!; });
    await act(async () => { await result.current.backupHistory(); });
    expect(name).toBe('licell_history_backup_2026-10-23.json');
    const backup = JSON.parse(await blob!.text());
    expect(backup.map((h: any) => [h.id, h.transcript ?? h.text])).toEqual([['b', 'hello'], ['c', 'legacy text field'], ['a', items[0].transcript]]);
    expect(addToast).toHaveBeenLastCalledWith('Backup download started', 'info');

    const file = new File([JSON.stringify([{ id: 'n', date: '2026-10-23T00:00:00Z', transcript: 't' }, { id: 'bad' }])], 'b.json');
    await act(async () => { await result.current.restoreHistory(file); });
    expect(m.store.has('n')).toBe(true);
    expect(m.store.has('bad')).toBe(false);
    expect(addToast).toHaveBeenLastCalledWith('History restored successfully', 'success');
    await act(async () => { await result.current.restoreHistory(new File(['{"x":1}'], 'x.json')); });
    expect(addToast).toHaveBeenLastCalledWith('Failed to restore history', 'error');
  });
});
