import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ store: new Map<string, any>() }));
vi.mock('./db', () => ({
  STORES: { HISTORY: 'studio_history' },
  getFromStore: vi.fn(async (_s: string, id: string) => m.store.get(id)),
  addToStore: vi.fn(async (_s: string, item: any) => { m.store.set(item.id, item); }),
  initDB: vi.fn(async () => ({ transaction: () => ({ objectStore: () => ({ openCursor: () => {
    const req: any = {}; const values = [...m.store.values()]; let i = 0;
    const step = () => queueMicrotask(() => { req.result = i < values.length ? { value: values[i], continue: () => { i++; step(); } } : null; req.onsuccess(); });
    step(); return req;
  } }) }) })),
}));

import { toLightHistoryItem, loadLightHistory, getHistoryTranscript, findHistoryIdsByTranscript, updateHistoryRecord } from './historyRecords';
import { addToStore } from './db';

beforeEach(() => {
  vi.clearAllMocks();
  m.store = new Map([
    ['a', { id: 'a', fileName: 'a.mp3', transcript: 'Border guard news', isFavorite: false }],
    ['b', { id: 'b', fileName: 'b.mp3', text: 'legacy text only' }],
  ]);
});

describe('historyRecords', () => {
  it('keeps every field except the transcript text in light items', async () => {
    expect(toLightHistoryItem({ id: 'x', transcript: 't', text: 'u', fileName: 'f', bgbRemark: 'Neutral' })).toEqual({ id: 'x', fileName: 'f', bgbRemark: 'Neutral' });
    expect(await loadLightHistory()).toEqual([{ id: 'a', fileName: 'a.mp3', isFavorite: false }, { id: 'b', fileName: 'b.mp3' }]);
  });

  it('reads one transcript and finds ids by transcript or legacy text', async () => {
    expect(await getHistoryTranscript('a')).toBe('Border guard news');
    expect(await getHistoryTranscript('missing')).toBe('');
    expect([...await findHistoryIdsByTranscript(/guard/i)]).toEqual(['a']);
    expect([...await findHistoryIdsByTranscript(/LEGACY/i)]).toEqual(['b']);
  });

  it('merges a change made on a light item into the saved record, keeping its transcript', async () => {
    const [light] = await loadLightHistory();
    expect(await updateHistoryRecord(light.id, { isFavorite: !light.isFavorite })).toBe(true);
    await updateHistoryRecord('a', { hasBeenOpened: true });
    expect(m.store.get('a')).toEqual({ id: 'a', fileName: 'a.mp3', transcript: 'Border guard news', isFavorite: true, hasBeenOpened: true });
  });

  it('does not create a record that was never saved', async () => {
    expect(await updateHistoryRecord('ghost', { hasBeenOpened: true })).toBe(false);
    expect(addToStore).not.toHaveBeenCalled();
  });
});
