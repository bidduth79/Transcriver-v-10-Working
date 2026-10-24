import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  configured: { value: true },
  local: new Map<string, any>(),
  cloud: {} as Record<string, { id: string; data: any }[]>,
  setDoc: vi.fn(async (..._a: any[]) => {}),
  getDocs: vi.fn(),
}));

vi.mock('./firebase', () => ({
  get db() { return m.configured.value ? { fake: true } : null; },
  get isFirebaseConfigured() { return m.configured.value; },
  authPromise: Promise.resolve(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: any, store: string, id: string) => `${store}/${id}`, setDoc: m.setDoc, serverTimestamp: () => 'SERVER_TIME',
}));
vi.mock('firebase/firestore/lite', () => ({
  setLogLevel: vi.fn(), getFirestore: () => ({}), collection: (_db: any, name: string) => name,
  query: (name: string, ...c: any[]) => Object.assign({ name }, ...c),
  orderBy: () => ({}), documentId: () => '__name__', startAfter: (d: any) => ({ after: d.id }), limit: (n: number) => ({ lim: n }),
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
    });
    return tx;
  },
};
vi.mock('./db', () => ({
  getFromStore: vi.fn(async (store: string, id: string) => m.local.get(`${store}::${id}`)),
  initDB: vi.fn(async () => fakeIdb),
}));

const load = async () => import('./firebaseThrottledQueue');
// Compare Bengali status text after NFC normalization (source and test may encode "য়" differently)
const stats = (q: any) => { const s = q.getFirebaseSyncStats(); return { ...s, statusMessageBn: s.statusMessageBn.normalize('NFC') }; };
// One page of a collection, ordered by id like Firestore's documentId()
const page = (q: any) => (m.cloud[q.name] || []).filter(d => q.after === undefined || d.id > q.after)
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
  m.getDocs.mockImplementation(async (q: any) => snap(page(q)));
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('push queue', () => {
  it('does nothing when Firebase is not configured', async () => {
    m.configured.value = false;
    const q = await load();
    q.enqueueFirebaseWrite('studio_history', '1');
    expect(stats(q)).toMatchObject({ pendingWrites: 0, statusMessageBn: 'ফায়ারবেইজ কনফিগার করা নেই' });
    expect(await q.scheduleGentleFirebasePull()).toEqual({ pulledCount: 0, cloudTotal: 0 });
    expect(stats(q).statusMessageBn).toBe('ফায়ারবেইজ কনফিগার করা নেই (.env)');
  });

  it('dedupes, waits 4.5s, sends sanitized docs 2.5s apart and handles deletes', async () => {
    const q = await load();
    const listener = vi.fn();
    const unsub = q.subscribeFirebaseSyncStats(listener);
    m.local.set('studio_history::1', { id: '1', text: 'a', skip: undefined });
    m.local.set('studio_history::2', { id: '2', text: 'b' });
    q.enqueueFirebaseWrite('studio_history', '1');
    q.enqueueFirebaseWrite('studio_history', '1');
    q.enqueueFirebaseWrite('studio_history', '2');
    q.enqueueFirebaseDelete('reports', '9');
    q.enqueueFirebaseWrite('studio_history', 'missing');
    expect(stats(q)).toMatchObject({ pendingWrites: 4, isPushing: false, statusMessageBn: 'প্রস্তুত (Idle)' });

    await vi.advanceTimersByTimeAsync(4499);
    expect(m.setDoc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc).toHaveBeenLastCalledWith('studio_history/1', { id: '1', text: 'a', _syncedAt: 'SERVER_TIME' });
    expect(stats(q)).toMatchObject({ isPushing: true, statusMessageBn: 'ব্যাকগ্রাউন্ডে ধীরে ধীরে ফায়ারবেইজে সেভ হচ্ছে...' });
    await vi.advanceTimersByTimeAsync(2500);
    expect(m.setDoc).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2500);
    // A delete leaves a small marker so other devices remove their copy too
    expect(m.setDoc).toHaveBeenLastCalledWith('reports/9', { id: '9', _deleted: true, _syncedAt: 'SERVER_TIME' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(m.setDoc).toHaveBeenCalledTimes(3);
    expect(stats(q)).toMatchObject({ pendingWrites: 0, isPushing: false, statusMessageBn: 'ফায়ারবেইজ সিঙ্ক সম্পূর্ণ আপ-টু-ডেট আছে' });
    expect(stats(q).lastSyncTime).not.toBeNull();
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('keeps going after a failed document', async () => {
    const q = await load();
    m.local.set('studio_history::1', { id: '1' });
    m.local.set('studio_history::2', { id: '2' });
    m.setDoc.mockRejectedValueOnce(new Error('boom'));
    q.enqueueFirebaseWrite('studio_history', '1');
    q.enqueueFirebaseWrite('studio_history', '2');
    await vi.advanceTimersByTimeAsync(4500 + 2500 + 2500);
    expect(m.setDoc).toHaveBeenCalledTimes(2);
  });

  it('pauses while transcription/batch runs and resumes 8s after the last lock is released', async () => {
    const q = await load();
    m.local.set('studio_history::1', { id: '1' });
    q.setHeavyProcessingActive('batch', true);
    q.enqueueFirebaseWrite('studio_history', '1');
    expect(stats(q)).toMatchObject({ isPausedForProcessing: true, statusMessageBn: 'ব্যাচ প্রসেসিং চলছে — ফায়ারবেইজ সিঙ্ক সাময়িক বিরতিতে আছে (অপেক্ষমাণ: 0টি)' });
    q.setHeavyProcessingActive('transcription', true);
    expect(stats(q).statusMessageBn).toBe('ট্রান্সক্রিপশন চলছে — ফায়ারবেইজ সিঙ্ক সাময়িক বিরতিতে আছে');
    await vi.advanceTimersByTimeAsync(20000);
    expect(m.setDoc).not.toHaveBeenCalled();
    q.setHeavyProcessingActive('batch', false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(m.setDoc).not.toHaveBeenCalled();
    q.setHeavyProcessingActive('transcription', false);
    expect(stats(q).statusMessageBn).toBe('কাজ সম্পন্ন — ৮ সেকেন্ড পর ধীরে ধীরে 1টি ডাটা ফায়ারবেইজে সিঙ্ক হবে...');
    await vi.advanceTimersByTimeAsync(7999);
    expect(m.setDoc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    q.setHeavyProcessingActive('batch', true);
    q.setHeavyProcessingActive('batch', false);
    expect(stats(q).statusMessageBn).toBe('প্রস্তুত (Idle)');
  });

  it('stops mid-queue when processing starts and waits while offline', async () => {
    const q = await load();
    ['1', '2', '3'].forEach(id => { m.local.set(`studio_history::${id}`, { id }); q.enqueueFirebaseWrite('studio_history', id); });
    await vi.advanceTimersByTimeAsync(4500);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    q.setHeavyProcessingActive('transcription', true);
    await vi.advanceTimersByTimeAsync(2500);
    expect(stats(q).statusMessageBn).toBe('প্রসেসিং শুরু হওয়ায় ফায়ারবেইজ সিঙ্ক পজ করা হয়েছে (বাকি: 2টি)');
    (navigator as any).onLine = false;
    q.setHeavyProcessingActive('transcription', false);
    await vi.advanceTimersByTimeAsync(8000 + 15000);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    (navigator as any).onLine = true;
    await vi.advanceTimersByTimeAsync(5000 + 2500);
    expect(m.setDoc).toHaveBeenCalledTimes(3);
  });
});
