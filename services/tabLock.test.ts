import { describe, it, expect, vi, afterEach } from 'vitest';
import { claimTabLock } from './tabLock';

// Web Locks as two tabs of one browser see them: a name is held by one holder until its callback's promise ends
const fakeLocks = () => {
  const held = new Set<string>();
  return {
    request: async (name: string, _options: { ifAvailable: boolean }, callback: (lock: object | null) => unknown) => {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('claimTabLock', () => {
  it('gives the lock to one tab at a time, and to the next once it is let go', async () => {
    vi.stubGlobal('navigator', { locks: fakeLocks() });
    const release = await claimTabLock('batch');
    expect(release).toBeTypeOf('function');
    expect(await claimTabLock('batch')).toBeNull();
    expect(await claimTabLock('folder')).toBeTypeOf('function');
    release?.();
    await Promise.resolve();
    expect(await claimTabLock('batch')).toBeTypeOf('function');
  });

  it('lets every tab work on its own where the browser has no Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    expect(await claimTabLock('batch')).toBeTypeOf('function');
    expect(await claimTabLock('batch')).toBeTypeOf('function');
  });
});
