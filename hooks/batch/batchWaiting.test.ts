import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ pendingTick: null as null | (() => void), lockFree: true }));
vi.mock('../../services/firebaseThrottledQueue', () => ({ setHeavyProcessingActive: vi.fn() }));
vi.mock('./batchUtils', () => ({ getFileMetadata: async (f: File) => ({ name: f.name }) }));
vi.mock('./useBatchMetrics', () => ({ useBatchMetrics: () => ({ progress: 0, etaSeconds: 0, resetMetrics: vi.fn() }) }));
// Countdown stub: the next file starts when the test calls tick()
vi.mock('./useBatchTimer', () => ({
  useBatchTimer: (ref: { current: boolean }) => ({
    batchCountdown: 0, setBatchCountdown: vi.fn(), isExtendedPause: false, setIsExtendedPause: vi.fn(), clearTimer: vi.fn(),
    startCountdown: (next: number, len: number, onTick: () => void, onFinish: () => void) => {
      if (ref.current) return;
      if (next >= len) onFinish(); else m.pendingTick = onTick;
    },
  }),
}));
// The lock between tabs: free, or held by another tab
vi.mock('../../services/tabLock', () => ({ claimTabLock: async () => (m.lockFree ? () => {} : null) }));

import { useBatchProcessor } from '../useBatchProcessor';
import { useHistoryStore } from '../useHistoryStore';
import { useBatchDuplicateStore } from './useBatchDuplicateStore';

const file = (name: string) => new File(['x'], name);
const MIN = 60_000;
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const busy = { success: false, error: 'busy', kind: 'busy' };

const setup = (process: ReturnType<typeof vi.fn>) => {
  const addToast = vi.fn();
  const hook = renderHook(() => useBatchProcessor('en', addToast, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), process as never));
  const start = async (files: File[]) => {
    await act(async () => { hook.result.current.setBatchQueue(files); });
    await act(async () => { hook.result.current.startBatch(); });
    await wait(200);
  };
  return { addToast, process, start, r: () => hook.result.current };
};

beforeEach(() => {
  m.pendingTick = null;
  m.lockFree = true;
  useHistoryStore.setState({ history: [] });
  useBatchDuplicateStore.getState().reset();
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('a batch and a busy server', () => {
  it('waits two minutes and tries the same file again, without marking it as failed', async () => {
    const s = setup(vi.fn().mockResolvedValueOnce(busy).mockResolvedValue({ success: true }));
    await s.start([file('a.mp3'), file('b.mp3')]);
    expect(s.addToast).toHaveBeenLastCalledWith('The server is busy. a.mp3 will be tried again in 2 minute(s).', 'warning');
    await wait(2 * MIN - 1000);
    expect(s.process).toHaveBeenCalledTimes(1);
    await wait(1200);
    expect(s.process.mock.calls.map(call => call[0].name)).toEqual(['a.mp3', 'a.mp3']);
    expect(s.r()).toMatchObject({ failedFiles: [], processedCount: 1 });
  });

  it('pauses at the file when the server stays busy through every wait, failing nothing', async () => {
    const s = setup(vi.fn().mockResolvedValue(busy));
    await s.start([file('a.mp3'), file('b.mp3')]);
    await wait(2 * MIN + 200);
    await wait(5 * MIN + 200);
    await wait(10 * MIN + 200);
    expect(s.process).toHaveBeenCalledTimes(4);
    expect(s.r()).toMatchObject({ isBatchPaused: true, currentBatchIndex: 0, failedFiles: [] });
    expect(s.addToast).toHaveBeenLastCalledWith('The server is still busy, so the batch was paused at this file. Press Resume later; no file was marked as failed.', 'error');
  });

  it('does not try a refused audio a second time', async () => {
    const s = setup(vi.fn().mockResolvedValueOnce({ success: false, error: 'refused', kind: 'refused' }).mockResolvedValue({ success: true }));
    await s.start([file('a.mp3'), file('b.mp3')]);
    expect(s.process).toHaveBeenCalledTimes(1);
    expect(s.r().failedFiles.map(f => f.reason)).toEqual(['refused']);
  });
});

describe('a batch while another tab is transcribing', () => {
  it('waits its turn, says so once, and goes on when the other tab is done', async () => {
    m.lockFree = false;
    const s = setup(vi.fn().mockResolvedValue({ success: true }));
    await s.start([file('a.mp3')]);
    await wait(31_000);
    expect(s.process).not.toHaveBeenCalled();
    expect(s.addToast.mock.calls.filter(call => call[0].startsWith('Another tab'))).toHaveLength(1);
    m.lockFree = true;
    await wait(15_000);
    expect(s.process).toHaveBeenCalledTimes(1);
  });
});
