import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiText } from '../utils/uiText';

const m = vi.hoisted(() => ({
  configured: { value: true },
  local: new Map<string, any>(),
  cloud: {} as Record<string, { id: string; data: any }[]>,
  setDoc: vi.fn(async (..._a: any[]) => {}),
  deleteDoc: vi.fn(async (..._a: any[]) => {}),
  getDocs: vi.fn(),
  counts: 0,
  docsRead: 0,
}));

vi.mock('./firebase', () => ({
  get db() { return m.configured.value ? { fake: true } : null; },
  get isFirebaseConfigured() { return m.configured.value; },
  authPromise: Promise.resolve(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: any, store: string, id: string) => `${store}/${id}`, setDoc: m.setDoc, deleteDoc: m.deleteDoc,
  serverTimestamp: () => 'SERVER_TIME', Bytes: { fromUint8Array: (u: Uint8Array) => ({ gz: u.length }) },
}));
vi.mock('firebase/firestore/lite', () => ({
  setLogLevel: vi.fn(), getFirestore: () => ({}), collection: (_db: any, name: string) => name,
  query: (name: string, ...c: any[]) => Object.assign({ name }, ...c),
  orderBy: () => ({}), documentId: () => '__name__', startAfter: (d: any) => ({ after: d.id }), limit: (n: number) => ({ lim: n }),
  where: (field: string, _op: string, min: any) => ({ field, min }), Timestamp: { fromDate: (d: Date) => ({ ms: d.getTime() }) },
  // A query object here is the count of deletion markers
  getCount: async (q: any) => {
    m.counts++;
    const docs = typeof q === 'string' ? (m.cloud[q] || []) : (m.cloud[q.name] || []).filter((d: any) => d.data[q.field] === q.min);
    return { data: () => ({ count: docs.length }) };
  },
  getDocs: m.getDocs,
}));

// In-memory IndexedDB stand-in: keys are "store::id"
const fakeIdb = {
  transaction: (stores: string[]) => {
    const store = stores[0];
    const tx: any = {};
    tx.objectStore = () => ({
      getAllKeys: () => {
        const req: any = {};
        queueMicrotask(() => { req.result = [...m.local.keys()].filter(k => k.startsWith(store + '::')).map(k => k.split('::')[1]); req.onsuccess(); });
        return req;
      },
      put: (item: any) => { m.local.set(`${store}::${item.id}`, item); queueMicrotask(() => tx.oncomplete?.()); },
      delete: (id: string) => { m.local.delete(`${store}::${id}`); queueMicrotask(() => tx.oncomplete?.()); },
    });
    return tx;
  },
};
vi.mock('./historyRecords', () => ({
  forEachHistoryRecord: async (visit: any) => [...m.local].filter(([k]) => k.startsWith('studio_history::')).forEach(([, v]) => visit(v)),
}));
vi.mock('./db', () => ({
  getFromStore: vi.fn(async (store: string, id: string) => m.local.get(`${store}::${id}`)),
  initDB: vi.fn(async () => fakeIdb),
}));

// Captured before fake timers: gzip runs on Node's zlib threads, which need real time
const realSetTimeout = globalThis.setTimeout;
const realWait = (ms: number) => new Promise(r => realSetTimeout(r, ms));
// cloudRepair is imported lazily during a manual sync; load it first so fake timers keep pace
const load = async () => { await import('./firebaseSync/cloudRepair'); return import('./firebaseThrottledQueue'); };
// Compare Bengali status text after NFC normalization (source and test may encode "য়" differently)
const stats = (q: any) => { const s = q.getFirebaseSyncStats(); return { ...s, statusMessageBn: s.statusMessageBn.normalize('NFC') }; };
// One page of a collection; where(field, '>=', min) compares timestamps ({ ms }) or strings
const atLeast = (q: any, v: any) => (q.min?.ms !== undefined ? (v?.ms ?? -1) >= q.min.ms : v >= q.min);
const page = (q: any) => (m.cloud[q.name] || []).filter(d => (q.after === undefined || d.id > q.after) && (!q.field || atLeast(q, d.data[q.field])))
  .sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, q.lim)
  .map(d => ({ id: d.id, data: () => d.data }));
const snap = (docs: any[]) => ({ size: docs.length, empty: docs.length === 0, docs, forEach: (fn: any) => docs.forEach(fn) });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  m.configured.value = true;
  m.local.clear();
  m.cloud = {};
  m.counts = 0;
  m.docsRead = 0;
  localStorage.clear();
  vi.setSystemTime(new Date('2026-10-23T12:00:00'));
  m.getDocs.mockImplementation(async (q: any) => { const docs = page(q); m.docsRead += docs.length; return snap(docs); });
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('gentle pull', () => {
  const NOW = new Date('2026-10-23T12:00:00').getTime();
  const old = Array.from({ length: 10 }, (_, i) => ({ id: `old${i}`, data: { fileName: `o${i}`, date: '2026-10-10T08:00:00.000Z' } }));
  const seed = () => {
    m.cloud.studio_history = [
      ...old,
      // saved yesterday by an app version without the sync stamp
      { id: 'y', data: { fileName: 'yesterday', date: new Date('2026-10-22T09:00:00').toISOString() } },
      { id: 't', data: { fileName: 'today', date: new Date(NOW - 3600000).toISOString(), _syncedAt: { ms: NOW - 3600000 } } },
    ];
    m.cloud.studio_reports = [{ id: 'r-old', data: { a: 0 } }, { id: 'r-new', data: { a: 1, _syncedAt: { ms: NOW - 60000 } } }];
    m.local.set('studio_history::old0', { id: 'old0', fileName: 'local' });
  };
  const runPull = async (q: any, onHistory?: () => void, forced = false) => {
    const p = q.scheduleGentleFirebasePull(onHistory, forced);
    await vi.advanceTimersByTimeAsync(60000);
    return p;
  };

  it('at app start reads only today, yesterday and newly saved docs, and counts the cloud total', async () => {
    seed();
    const q = await load();
    const onHistory = vi.fn();
    const p = q.scheduleGentleFirebasePull(onHistory);
    await vi.advanceTimersByTimeAsync(3999);
    expect(m.getDocs).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(await p).toEqual({ pulledCount: 3, cloudTotal: 12 });
    expect([...m.local.keys()].sort()).toEqual(['studio_history::old0', 'studio_history::t', 'studio_history::y', 'studio_reports::r-new']);
    expect(m.local.get('studio_history::t')).toEqual({ id: 't', fileName: 'today', date: new Date(NOW - 3600000).toISOString() });
    expect(m.docsRead).toBe(4);
    expect(m.counts).toBe(2);
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(stats(q)).toMatchObject({ isPulling: false, lastPulledCount: 3, totalCloudHistoryDocs: 12 });
    // The pull started 4s after launch; the checkpoint keeps a 10-minute overlap for clock differences
    expect(Number(localStorage.getItem('firebase_pull_checkpoint_studio_history'))).toBe(NOW + 4000 - 600000);
  });

  it('next app start reads only what was saved after the last pull', async () => {
    seed();
    await runPull(await load());
    vi.resetModules();
    vi.setSystemTime(NOW + 86400000);
    m.cloud.studio_history.push({ id: 'n', data: { fileName: 'next', date: new Date(NOW + 86000000).toISOString(), _syncedAt: { ms: NOW + 86000000 } } });
    m.docsRead = 0;
    expect(await runPull(await load())).toEqual({ pulledCount: 1, cloudTotal: 13 });
    expect(m.local.get('studio_history::n').fileName).toBe('next');
    // 'n' via the stamp and via its date, 't' via its date, and 'r-new' again inside the 10-minute overlap
    expect(m.docsRead).toBe(4);
    expect(m.local.size).toBe(5);
  });

  it('removes an item deleted on another device and does not count its marker', async () => {
    seed();
    await runPull(await load());
    vi.resetModules();
    vi.setSystemTime(NOW + 3600000);
    m.cloud.studio_history = m.cloud.studio_history.map(d => (d.id === 't' ? { id: 't', data: { _deleted: true, _syncedAt: { ms: NOW + 3500000 } } } : d));
    const onHistory = vi.fn();
    expect(await runPull(await load(), onHistory)).toEqual({ pulledCount: 0, cloudTotal: 11 });
    expect(m.local.has('studio_history::t')).toBe(false);
    expect(m.local.has('studio_history::y')).toBe(true);
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('a manual sync from Settings still brings every missing document', async () => {
    seed();
    const q = await load();
    expect(await runPull(q, undefined, true)).toEqual({ pulledCount: 13, cloudTotal: 12 });
    expect(m.local.get('studio_history::old0').fileName).toBe('local');
    expect(m.local.get('studio_history::old9')).toMatchObject({ fileName: 'o9' });
    expect(m.counts).toBe(0);
    expect(await runPull(q, undefined, true)).toEqual({ pulledCount: 0, cloudTotal: 12 });
  });

  it('a manual sync re-sends long plain cloud transcripts compressed, and huge ones the cloud lacks', async () => {
    seed();
    const long = 'ক'.repeat(8000);
    const huge = 'খ'.repeat(320000);
    m.cloud.studio_history.push({ id: 'big', data: { fileName: 'big', transcript: long } });
    m.local.set('studio_history::big', { id: 'big', fileName: 'big', transcript: long });
    m.local.set('studio_history::huge', { id: 'huge', fileName: 'huge', transcript: huge });
    m.local.set('studio_history::gone', { id: 'gone', fileName: 'deleted elsewhere', transcript: 'short' });
    const q = await load();
    await runPull(q, undefined, true);
    // The push queue sends one document every 2.5s; gzip itself runs on real time
    for (let i = 0; i < 20 && m.setDoc.mock.calls.length < 2; i++) { await vi.advanceTimersByTimeAsync(3000); await realWait(20); }
    const sent = m.setDoc.mock.calls.map(c => [c[0], 'transcript' in c[1], c[1].transcriptGz?.gz > 0, c[1]._syncedAt]);
    expect(sent.sort()).toEqual([['studio_history/big', false, true, 'SERVER_TIME'], ['studio_history/huge', false, true, 'SERVER_TIME']]);
  });

  it('skips while processing unless forced, and reports connection and quota errors', async () => {
    const q = await load();
    q.setHeavyProcessingActive('batch', true);
    expect(await q.scheduleGentleFirebasePull()).toEqual({ pulledCount: 0, cloudTotal: 0 });
    expect(m.getDocs).not.toHaveBeenCalled();
    const { initDB } = await import('./db');
    (initDB as any).mockRejectedValueOnce(new Error('idb down'));
    const forced = q.scheduleGentleFirebasePull(undefined, true);
    await vi.advanceTimersByTimeAsync(100);
    expect(await forced).toEqual({ pulledCount: 0, cloudTotal: 0, failure: 'failed' });
    expect(stats(q).statusMessageBn).toBe('ফায়ারবেইজ কানেকশন সাময়িকভাবে পাওয়া যায়নি');
    m.getDocs.mockRejectedValueOnce(Object.assign(new Error('Quota exceeded.'), { code: 'resource-exhausted' }));
    expect(await runPull(q, undefined, true)).toEqual({ pulledCount: 0, cloudTotal: 0, failure: 'quota' });
    expect(m.getDocs).toHaveBeenCalledTimes(1);
    expect(stats(q).statusMessageBn).toBe(uiText('bn', 'firebaseQuotaExceeded'));
  });
});
