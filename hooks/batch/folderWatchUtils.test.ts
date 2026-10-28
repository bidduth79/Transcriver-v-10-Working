import { describe, it, expect } from 'vitest';
import { pickNewFiles } from './folderWatchUtils';

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
    const first = pickNewFiles([a, b, notes], { done: [], lastSizes: new Map() });
    expect(first.ready).toEqual([]);
    expect([...first.sizes]).toEqual([['b.mp3', 200], ['a.opus', 100]]);
    const second = pickNewFiles([a, b, notes], { done: [], lastSizes: first.sizes });
    expect(second.ready.map(f => f.name)).toEqual(['b.mp3', 'a.opus']);
  });

  it('waits while a file is still being copied', () => {
    const growing = file('a.opus', 150, 2);
    expect(pickNewFiles([growing], { done: [], lastSizes: new Map([['a.opus', 100]]) }).ready).toEqual([]);
  });

  it('skips files already in history or already handed to a batch', () => {
    const lastSizes = new Map([['a.opus', 100], ['b.mp3', 200]]);
    const { ready } = pickNewFiles([a, b], { done: [{ name: 'a.opus', size: '0.01 MB' }, b], lastSizes });
    expect(ready).toEqual([]);
  });

  it('takes one recording saved under two dates only once, the older file', () => {
    const older = file('Talk_2026-10-27.opus', 10046926, 1);
    const newer = file('Talk_2026-10-28.opus', 10056615, 2);
    const lastSizes = new Map([[older.name, older.size], [newer.name, newer.size]]);
    expect(pickNewFiles([newer, older], { done: [], lastSizes }).ready.map(f => f.name)).toEqual(['Talk_2026-10-27.opus']);
    expect(pickNewFiles([newer], { done: [{ name: older.name, size: '9.58 MB' }], lastSizes }).ready).toEqual([]);
  });
});
