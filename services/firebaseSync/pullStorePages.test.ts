import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  local: new Map<string, any>(),
  cloud: [] as { id: string; data: any }[],
  getDocs: vi.fn(),
}));

vi.mock('firebase/firestore/lite', () => ({
  setLogLevel: vi.fn(),
  getFirestore: (app: any) => ({ lite: app }),
  collection: (db: any, name: string) => (db.lite === 'APP' ? name : 'wrong-db'),
  query: (name: string, ...c: any[]) => Object.assign({ name }, ...c),
  orderBy: () => ({}), documentId: () => '__name__', startAfter: (d: any) => ({ after: d.id }), limit: (n: number) => ({ lim: n }),
  where: (field: string, _op: string, min: any) => ({ field, min }),
  Timestamp: { fromDate: (d: Date) => ({ ms: d.getTime() }) },
  getDocs: m.getDocs,
}));
vi.mock('./syncState', () => ({ syncStats: {}, notifyListeners: vi.fn(), sleep: async () => {} }));

import { pullStoreInPages, PULL_PAGE_SIZE } from './pullStorePages';

const fakeIdb: any = {
  transaction: () => {
    const tx: any = {};
    tx.objectStore = () => ({
      getAllKeys: () => {
        const req: any = {};
        queueMicrotask(() => { req.result = [...m.local.keys()]; req.onsuccess(); });
        return req;
      },
      put: (item: any) => { m.local.set(item.id, item); queueMicrotask(() => tx.oncomplete?.()); },
    });
    return tx;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  m.local.clear();
  m.getDocs.mockImplementation(async (q: any) => {
    // where(field, '>=', min): a timestamp min ({ ms }) compares with the field's { ms }
    const atLeast = (v: any) => (q.min?.ms !== undefined ? (v?.ms ?? -1) >= q.min.ms : v >= q.min);
    const docs = m.cloud.filter(d => (q.after === undefined || d.id > q.after) && (!q.field || atLeast(d.data[q.field])))
      .sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, q.lim)
      .map(d => ({ id: d.id, data: () => d.data }));
    return { size: docs.length, empty: docs.length === 0, docs, forEach: (fn: any) => docs.forEach(fn) };
  });
});

const cloudDocs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id${String(i).padStart(4, '0')}`, data: { n: i } }));
const run = (shouldStop = () => false, since?: { field: string; min: string | Date }) => {
  const counts: number[] = [];
  const onMerged = vi.fn();
  const result = pullStoreInPages({ db: { app: 'APP' } as any, idb: fakeIdb, storeName: 'studio_history', shouldStop, onCloudCount: c => counts.push(c), onMerged, since });
  return { result, counts, onMerged };
};

describe('pullStoreInPages', () => {
  it('reads the collection one page at a time and merges only missing docs', async () => {
    m.cloud = cloudDocs(120);
    m.local.set('id0000', { id: 'id0000', local: true });
    const { result, counts, onMerged } = run();
    expect(await result).toEqual({ cloudCount: 120, merged: 119, completed: true });
    expect(m.getDocs).toHaveBeenCalledTimes(3);
    expect(m.getDocs.mock.calls.map(c => [c[0].after, c[0].lim])).toEqual([
      [undefined, PULL_PAGE_SIZE], ['id0049', PULL_PAGE_SIZE], ['id0099', PULL_PAGE_SIZE],
    ]);
    expect(counts).toEqual([50, 100, 120]);
    expect(onMerged.mock.calls.reduce((s, c) => s + c[0], 0)).toBe(119);
    expect(m.local.get('id0000')).toEqual({ id: 'id0000', local: true });
    expect(m.local.get('id0119')).toEqual({ id: 'id0119', n: 119 });
  });

  it('asks once more when the last page is full, and handles an empty collection', async () => {
    m.cloud = cloudDocs(100);
    expect(await run().result).toEqual({ cloudCount: 100, merged: 100, completed: true });
    expect(m.getDocs).toHaveBeenCalledTimes(3);
    m.getDocs.mockClear();
    m.cloud = [];
    const { result, counts } = run();
    expect(await result).toEqual({ cloudCount: 0, merged: 0, completed: true });
    expect(m.getDocs).toHaveBeenCalledTimes(1);
    expect(counts).toEqual([0]);
  });

  it('stops between pages when asked to (e.g. a transcription starts)', async () => {
    m.cloud = cloudDocs(120);
    let stop = false;
    m.getDocs.mockImplementationOnce(async (q: any) => {
      stop = true;
      const docs = m.cloud.slice(0, q.lim).map(d => ({ id: d.id, data: () => d.data }));
      return { size: docs.length, empty: false, docs, forEach: (fn: any) => docs.forEach(fn) };
    });
    expect(await run(() => stop).result).toEqual({ cloudCount: 50, merged: 50, completed: false });
    expect(m.getDocs).toHaveBeenCalledTimes(1);
    expect(m.local.size).toBe(50);
  });

  it('reads only documents saved or dated after a point, and stores them without the sync stamp', async () => {
    m.cloud = [
      { id: 'old', data: { date: '2026-10-20T10:00:00.000Z', _syncedAt: { ms: 100 } } },
      { id: 'new', data: { date: '2026-10-23T10:00:00.000Z', _syncedAt: { ms: 900 } } },
    ];
    expect(await run(undefined, { field: '_syncedAt', min: new Date(500) }).result).toEqual({ cloudCount: 1, merged: 1, completed: true });
    expect(m.local.get('new')).toEqual({ id: 'new', date: '2026-10-23T10:00:00.000Z' });
    expect(m.local.has('old')).toBe(false);
    expect((await run(undefined, { field: 'date', min: '2026-10-21T18:00:00.000Z' }).result).cloudCount).toBe(1);
  });
});
