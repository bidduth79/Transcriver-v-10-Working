import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestPersistentStorage } from './storagePersistence';

const stubStorage = (storage: any) => vi.stubGlobal('navigator', { storage });
afterEach(() => vi.unstubAllGlobals());

describe('requestPersistentStorage', () => {
  it('asks only when storage is not persistent yet', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => false, persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    const again = vi.fn();
    stubStorage({ persisted: async () => true, persist: again });
    expect(await requestPersistentStorage()).toBe(true);
    expect(again).not.toHaveBeenCalled();
  });

  it('returns false when unsupported, denied or failing', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
    stubStorage({ persisted: async () => false, persist: async () => false });
    expect(await requestPersistentStorage()).toBe(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubStorage({ persisted: async () => { throw new Error('x'); }, persist: vi.fn() });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
