import { describe, it, expect } from 'vitest';
import { pickNewFiles, fileKey } from './folderWatchUtils';

const file = (name: string, size: number, lastModified: number) => {
  const f = new File(['x'], name, { lastModified });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('pickNewFiles', () => {
  const a = file('a.opus', 100, 2);
  const b = file('b.mp3', 200, 1);
  const notes = file('notes.txt', 10, 3);

  it('takes audio only once its size stays the same between two looks, oldest first', () => {
    const first = pickNewFiles([a, b, notes], { doneNames: new Set(), taken: new Set(), lastSizes: new Map() });
    expect(first.ready).toEqual([]);
    expect([...first.sizes]).toEqual([['a.opus', 100], ['b.mp3', 200]]);
    const second = pickNewFiles([a, b, notes], { doneNames: new Set(), taken: new Set(), lastSizes: first.sizes });
    expect(second.ready.map(f => f.name)).toEqual(['b.mp3', 'a.opus']);
  });

  it('waits while a file is still being copied', () => {
    const growing = file('a.opus', 150, 2);
    const { ready } = pickNewFiles([growing], { doneNames: new Set(), taken: new Set(), lastSizes: new Map([['a.opus', 100]]) });
    expect(ready).toEqual([]);
  });

  it('skips files already in history or already handed to a batch', () => {
    const lastSizes = new Map([['a.opus', 100], ['b.mp3', 200]]);
    const { ready } = pickNewFiles([a, b], { doneNames: new Set(['a.opus']), taken: new Set([fileKey(b)]), lastSizes });
    expect(ready).toEqual([]);
  });
});
