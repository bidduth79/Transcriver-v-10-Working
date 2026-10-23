import { describe, it, expect } from 'vitest';
import { searchAndGroupHistory } from './historyListUtils';

const light = [
  { id: 'a', fileName: 'news_clip#1.mp3', date: '2026-10-20T10:00:00' },
  { id: 'b', fileName: 'talk.mp3', date: '2026-10-20T12:00:00' },
  { id: 'c', fileName: 'other.wav', date: '2026-10-21T09:00:00' },
];
const ids = (groups: Record<string, any[]>) => Object.entries(groups).map(([d, items]) => [d, items.map(i => i.id)]);

describe('searchAndGroupHistory', () => {
  it('matches file names (raw and display form) and saved transcripts by id, grouped by day', () => {
    expect(ids(searchAndGroupHistory(light, 'news clip'))).toEqual([['10/20/2026', ['a']]]);
    expect(ids(searchAndGroupHistory(light, 'border', new Set(['b', 'c'])))).toEqual([['10/20/2026', ['b']], ['10/21/2026', ['c']]]);
    expect(ids(searchAndGroupHistory(light, 'border', null))).toEqual([]);
  });

  it('still searches transcript text that an item carries itself', () => {
    const inline = [{ id: 'x', fileName: 'f.mp3', date: 'bad date', transcript: 'Border guard' }, { id: 'y', fileName: 'g.mp3', text: 'border text' }];
    expect(ids(searchAndGroupHistory(inline, 'BORDER', new Set()))).toEqual([['Unknown Date', ['x', 'y']]]);
  });
});
