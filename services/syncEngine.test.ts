import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  local: { value: false }, fbConfigured: { value: true },
  idb: [] as any[], fb: [] as any[],
  setDoc: vi.fn(async () => {}), addToQueue: vi.fn(),
  enqueueWrite: vi.fn(), enqueueDelete: vi.fn(),
}));

vi.mock('./firebase', () => ({ get db() { return m.fbConfigured.value ? {} : null; }, get isFirebaseConfigured() { return m.fbConfigured.value; }, auth: {}, authPromise: Promise.resolve() }));
vi.mock('firebase/firestore', () => ({
  collection: (_d: any, n: string) => n, doc: (_d: any, s: string, id: string) => `${s}/${id}`,
  getDocs: vi.fn(async () => ({ docs: m.fb.map(d => ({ id: d.id, data: () => d })) })),
  setDoc: m.setDoc, serverTimestamp: () => 'SERVER_TIME',
}));
vi.mock('../utils/config', () => ({ getApiUrl: (p: string) => `http://local/${p}`, isLocalServerEnabled: () => m.local.value }));
vi.mock('./syncQueue', () => ({ addToQueue: m.addToQueue }));
vi.mock('./firebaseThrottledQueue', () => ({ enqueueFirebaseWrite: m.enqueueWrite, enqueueFirebaseDelete: m.enqueueDelete }));
vi.mock('./db', () => ({
  initDB: async () => ({ transaction: () => ({ objectStore: () => ({ getAll: () => { const r: any = {}; queueMicrotask(() => { r.result = m.idb; r.onsuccess(); }); return r; } }) }) }),
}));

import * as SE from './syncEngine';

const fetchMock = vi.fn();
const ok = (body: any) => ({ ok: true, text: async () => JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  m.local.value = false; m.fbConfigured.value = true;
  m.idb = []; m.fb = [];
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('flags', () => {
  it('keeps auto-sync defaults', () => {
    expect([SE.AUTO_SYNC_XAMPP_ENABLED, SE.AUTO_SYNC_FIREBASE_ENABLED]).toEqual([false, true]);
  });
});

describe('fetchDataDual', () => {
  it('merges IndexedDB and Firebase for synced stores, deduping by string id', async () => {
    m.idb = [{ id: 1, v: 'idb' }, { id: '2', v: 'idb' }, { v: 'no id' }, null];
    m.fb = [{ id: '1', v: 'fb' }, { id: '3', v: 'fb' }];
    expect(await SE.fetchDataDual('studio_history')).toEqual([{ id: '1', v: 'fb' }, { id: '2', v: 'idb' }, { id: '3', v: 'fb' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only reads IndexedDB for non-synced stores', async () => {
    m.idb = [{ id: 'a' }];
    m.fb = [{ id: 'b' }];
    expect(await SE.fetchDataDual('activity_logs')).toEqual([{ id: 'a' }]);
  });

  it('with forceAll pages through the local API', async () => {
    m.local.value = true;
    fetchMock
      .mockResolvedValueOnce(ok(Array.from({ length: 200 }, (_, i) => ({ data: { id: `L${i}` } }))))
      .mockResolvedValueOnce(ok([{ id: 'L200' }]));
    const all = await SE.fetchDataDual('studio_history', true);
    expect(all).toHaveLength(201);
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
      'http://local/api.php?action=get&store=studio_history&page=1&limit=200',
      'http://local/api.php?action=get&store=studio_history&page=2&limit=200',
    ]);
  });

  it('tolerates bad JSON, HTTP errors and a disabled local server', async () => {
    m.local.value = true;
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{bad' });
    m.fbConfigured.value = false;
    expect(await SE.fetchDataDual('studio_history', true)).toEqual([]);
    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await SE.fetchDataDual('activity_logs', true)).toEqual([]);
    m.local.value = false;
    expect(await SE.fetchDataDual('studio_history', true)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('saveDataDual / deleteDataDual', () => {
  it('queues Firebase writes in the background by default', async () => {
    expect(await SE.saveDataDual('studio_history', { id: 7, t: 'x' })).toBe(true);
    expect(m.enqueueWrite).toHaveBeenCalledWith('studio_history', '7', { id: '7', t: 'x' });
    expect(m.setDoc).not.toHaveBeenCalled();
    await SE.deleteDataDual('studio_history', '7');
    expect(m.enqueueDelete).toHaveBeenCalledWith('studio_history', '7');
  });

  it('writes everywhere immediately with forceAll and queues failed local writes', async () => {
    m.local.value = true;
    fetchMock.mockResolvedValueOnce({ ok: false });
    await SE.saveDataDual('studio_history', { id: 'a', t: 1 }, true);
    expect(fetchMock).toHaveBeenCalledWith('http://local/api.php?action=save&store=studio_history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":"a","t":1}' });
    expect(m.addToQueue).toHaveBeenCalledWith('local', 'save', 'studio_history', 'a', { id: 'a', t: 1 });
    expect(m.setDoc).toHaveBeenCalledWith('studio_history/a', { id: 'a', t: 1, _syncedAt: 'SERVER_TIME' });
    expect(m.enqueueWrite).not.toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new Error('down'));
    await SE.deleteDataDual('studio_history', 'a', true);
    expect(fetchMock).toHaveBeenLastCalledWith('http://local/api.php?action=delete&store=studio_history&id=a');
    expect(m.addToQueue).toHaveBeenLastCalledWith('local', 'delete', 'studio_history', 'a');
    expect(m.setDoc).toHaveBeenLastCalledWith('studio_history/a', { id: 'a', _deleted: true, _syncedAt: 'SERVER_TIME' });
    expect(m.addToQueue).toHaveBeenCalledTimes(2);
  });

  it('uses Date.now() as id when missing and skips cloud for non-synced stores', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    m.local.value = true;
    fetchMock.mockResolvedValue({ ok: true });
    await SE.saveDataDual('activity_logs', { t: 1 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ t: 1, id: '123' });
    expect(m.enqueueWrite).not.toHaveBeenCalled();
    await SE.deleteDataDual('activity_logs', 'z');
    expect(m.enqueueDelete).not.toHaveBeenCalled();
    expect(m.addToQueue).not.toHaveBeenCalled();
  });
});
