import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: any, store: string, id: string) => `${store}/${id}`,
  deleteDoc: vi.fn(async (ref: string) => { m.deleted.push(ref); }),
}));

import { removeCloudSecretCopies } from './secretCleanup';
import { FIREBASE_SYNCED_STORES, SECRET_STORES } from '../../constants/storeNames';

const local: Record<string, string[]> = { user_api_keys: ['k1', 'k2'], youtube_api_keys: ['y1'] };
const fakeIdb: any = {
  objectStoreNames: { contains: (name: string) => name in local },
  transaction: ([name]: string[]) => ({ objectStore: () => ({ getAllKeys: () => {
    const req: any = {};
    queueMicrotask(() => { req.result = local[name]; req.onsuccess(); });
    return req;
  } }) }),
};

beforeEach(() => { m.deleted = []; localStorage.clear(); });

describe('API keys stay off the cloud', () => {
  it('no secret store is synced to Firebase or Supabase', () => {
    expect(SECRET_STORES).toEqual(['user_api_keys', 'system_master_keys', 'youtube_api_keys']);
    expect(FIREBASE_SYNCED_STORES.some(s => SECRET_STORES.includes(s))).toBe(false);
  });

  it('removes the cloud copies of locally stored keys, once per device', async () => {
    expect(await removeCloudSecretCopies({} as any, fakeIdb)).toBe(3);
    expect(m.deleted).toEqual(['user_api_keys/k1', 'user_api_keys/k2', 'youtube_api_keys/y1']);
    expect(await removeCloudSecretCopies({} as any, fakeIdb)).toBe(0);
    expect(m.deleted).toHaveLength(3);
  });
});
