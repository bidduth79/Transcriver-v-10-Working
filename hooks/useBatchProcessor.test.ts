import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  lock: vi.fn(), clearTimer: vi.fn(() => { m.pendingTick = null; }), resetMetrics: vi.fn(),
  pendingTick: null as null | (() => void), pausedRef: null as any,
}));
vi.mock('../services/firebaseThrottledQueue', () => ({ setHeavyProcessingActive: m.lock }));
vi.mock('./batch/batchUtils', () => ({ getFileMetadata: async (f: File) => ({ name: f.name }) }));
vi.mock('./batch/useBatchMetrics', () => ({ useBatchMetrics: () => ({ progress: 0, etaSeconds: 0, resetMetrics: m.resetMetrics }) }));
// Countdown stub: the test fires the "next file" tick itself via tick()
vi.mock('./batch/useBatchTimer', () => ({
  useBatchTimer: (ref: any) => {
    m.pausedRef = ref;
    return {
      batchCountdown: 0, setBatchCountdown: vi.fn(), isExtendedPause: false, setIsExtendedPause: vi.fn(), clearTimer: m.clearTimer,
      startCountdown: (next: number, len: number, onTick: () => void, onFinish: () => void) => {
        if (ref.current) return;
        if (next >= len) onFinish(); else m.pendingTick = onTick;
      },
    };
  },
}));

import { useBatchProcessor } from './useBatchProcessor';

const file = (name: string, size = 10) => { const f = new File(['x'], name); Object.defineProperty(f, 'size', { value: size }); return f; };
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(200); });
const tick = async () => { const t = m.pendingTick; m.pendingTick = null; await act(async () => { t?.(); }); await settle(); };

const setup = (process = vi.fn(async () => ({ success: true }))) => {
  const deps = { addToast: vi.fn(), setFile: vi.fn(), setFileUrl: vi.fn(), setActiveHistoryId: vi.fn(), setTranscriptMeta: vi.fn(), setFileMeta: vi.fn() };
  const hook = renderHook(() => useBatchProcessor('bn', deps.addToast, deps.setFile, deps.setFileUrl, deps.setActiveHistoryId, deps.setTranscriptMeta, deps.setFileMeta, process as any));
  const queue = async (files: File[]) => act(async () => { hook.result.current.setBatchQueue(files); });
  const call = async (fn: string, ...args: any[]) => { await act(async () => { (hook.result.current as any)[fn](...args); }); await settle(); };
  return { ...deps, process, hook, queue, call, r: () => hook.result.current };
};
// NFC-normalized so Bengali "য়" matches regardless of how the source encodes it
const toasts = (s: any) => s.addToast.mock.calls.map((c: any[]) => `${c[1]}:${c[0]}`.normalize('NFC'));

let urls = 0;
beforeEach(() => {
  vi.clearAllMocks();
  m.pendingTick = null;
  urls = 0;
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => `blob:${++urls}`), revokeObjectURL: vi.fn() });
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('useBatchProcessor', () => {
  it('runs the whole queue, skipping oversize files, and shows a summary', async () => {
    const s = setup();
    await s.queue([file('a.mp3'), file('big.mp3', 70 * 1024 * 1024 + 1), file('c.mp3')]);
    await s.call('startBatch');
    expect(m.lock).toHaveBeenCalledWith('batch', true);
    expect(s.process).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.mp3' }), { name: 'a.mp3' }, true);
    expect([s.setFileUrl.mock.calls[0][0], s.setActiveHistoryId.mock.calls[0][0], s.setTranscriptMeta.mock.calls[0][0]]).toEqual(['blob:1', null, null]);
    await tick();
    expect(s.r().failedFiles.map(f => [f.file.name, f.reason])).toEqual([['big.mp3', 'Size exceeds 70MB']]);
    await tick();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(s.process).toHaveBeenCalledTimes(2);
    expect(s.r()).toMatchObject({ processedCount: 2, isBatchProcessing: false, hasBatchStarted: false, isBatchSummaryOpen: true, currentBatchIndex: 2 });
    expect(toasts(s)).toEqual(['error:big.mp3 ৭০ এমবি এর বেশি, স্কিপ করা হচ্ছে', 'warning:ব্যাচ সম্পন্ন। 2টি সফল, 1টি ব্যর্থ।']);
    expect(m.lock).toHaveBeenLastCalledWith('batch', false);
  });

  it('retries a failed file once after 3s, then records the failure', async () => {
    const process = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({}).mockRejectedValue(new Error('quota'));
    const s = setup(process);
    await s.queue([file('a.mp3'), file('b.mp3')]);
    await s.call('startBatch');
    expect(toasts(s)).toEqual(['warning:a.mp3 ব্যর্থ হয়েছে, আবার চেষ্টা করা হচ্ছে...']);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(process).toHaveBeenCalledTimes(2);
    await tick();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await settle();
    expect(s.r().failedFiles.map(f => f.reason)).toEqual(['quota']);
    expect(toasts(s).at(-2)).toBe('error:b.mp3 ট্রান্সক্রাইব করা যায়নি');
    expect(toasts(s).at(-1)).toBe('warning:ব্যাচ সম্পন্ন। 1টি সফল, 1টি ব্যর্থ।');

    await s.call('retryFailedFiles');
    expect(s.r().batchQueue.map(f => f.name)).toEqual(['b.mp3']);
    expect(s.r().failedFiles).toEqual([]);
  });

  it('reports full success', async () => {
    const s = setup();
    await s.queue([file('a.mp3')]);
    await s.call('startBatch');
    expect(toasts(s)).toEqual(['success:ব্যাচ প্রসেসিং সফলভাবে সম্পন্ন হয়েছে']);
  });

  it('pauses during the countdown and resumes with the next file, not the finished one', async () => {
    const s = setup();
    await s.queue([file('a.mp3'), file('b.mp3')]);
    await s.call('startBatch');
    await s.call('pauseBatch');
    expect(m.clearTimer).toHaveBeenCalled();
    expect(s.r()).toMatchObject({ isBatchPaused: true, currentBatchIndex: 1 });
    await tick();
    expect(s.process).toHaveBeenCalledTimes(1);
    await s.call('resumeBatch');
    expect(s.process.mock.calls.map((c: any[]) => c[0].name)).toEqual(['a.mp3', 'b.mp3']);
    expect(s.r().isBatchPaused).toBe(false);
  });

  it('pause and resume while a file is transcribing does not start it a second time', async () => {
    let finish: () => void = () => {};
    const s = setup(vi.fn(() => new Promise<any>(r => { finish = () => r({}); })));
    await s.queue([file('a.mp3'), file('b.mp3')]);
    await s.call('startBatch');
    await s.call('pauseBatch');
    await s.call('resumeBatch');
    expect(s.process).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await settle();
    await tick();
    expect(s.process.mock.calls.map((c: any[]) => c[0].name)).toEqual(['a.mp3', 'b.mp3']);
  });

  it('skips, jumps, removes files and cancels', async () => {
    const s = setup(vi.fn(() => new Promise(() => {})));
    await s.queue([file('a'), file('b'), file('c'), file('d')]);
    await s.call('jumpToBatchFile', 2);
    expect(s.r()).toMatchObject({ currentBatchIndex: 2, hasBatchStarted: true });
    await s.call('skipNextBatchFile');
    expect(s.r().currentBatchIndex).toBe(3);
    await s.call('removeBatchFile', 0);
    expect(s.r().batchQueue.map(f => f.name)).toEqual(['b', 'c', 'd']);
    expect(s.r().currentBatchIndex).toBe(2);
    await s.call('removeBatchFile', 2);
    expect((s.process.mock.calls.at(-1) as any[])[0].name).toBe('d');
    await s.call('cancelBatch');
    expect(s.r()).toMatchObject({ batchQueue: [], currentBatchIndex: 0, isBatchProcessing: false, hasBatchStarted: false, processedCount: 0 });
  });

  it('cancels when the last file is removed and cleans up on unmount', async () => {
    const s = setup(vi.fn(() => new Promise(() => {})));
    await s.queue([file('a')]);
    await s.call('startBatch');
    await s.call('removeBatchFile', 0);
    expect(s.r().batchQueue).toEqual([]);
    s.hook.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(m.lock).toHaveBeenLastCalledWith('batch', false);
  });
});
