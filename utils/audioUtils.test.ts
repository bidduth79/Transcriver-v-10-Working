import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ update: vi.fn(async () => true), getFromStore: vi.fn(async () => undefined) }));
vi.mock('../services/db', () => ({ getFromStore: m.getFromStore }));
vi.mock('../services/historyRecords', () => ({ updateHistoryRecord: m.update }));

import { loadAudioFromStore } from './audioUtils';

const load = (item: any) => loadAudioFromStore(item, vi.fn(), vi.fn(), vi.fn(), vi.fn());

beforeEach(() => vi.clearAllMocks());

describe('loadAudioFromStore: opened flag', () => {
  it('marks an unopened history item as opened by merging into its saved record', async () => {
    await load({ id: 'h1', fileName: 'a.mp3' });
    expect(m.update).toHaveBeenCalledWith('h1', { hasBeenOpened: true });
    expect(m.getFromStore).toHaveBeenCalledWith('youtube_audio', 'h1');
  });

  it('leaves opened history items and YouTube monitor items alone', async () => {
    await load({ id: 'h1', hasBeenOpened: true });
    await load({ id: 'y1', videoId: 'v1' });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.getFromStore).toHaveBeenLastCalledWith('youtube_audio', 'v1');
  });
});
