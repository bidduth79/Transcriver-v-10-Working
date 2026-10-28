import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchMetrics } from './useBatchMetrics';

const fileOf = (mb: number) => new File([new Uint8Array(mb * 1024 * 1024)], `${mb}mb.opus`);

afterEach(() => vi.useRealTimers());

describe('useBatchMetrics', () => {
  it('estimates the time left from how much audio is left, not how many files', () => {
    vi.useFakeTimers();
    const queue = [fileOf(1), fileOf(3), fileOf(1)];
    const { result, rerender } = renderHook(({ index }) => useBatchMetrics(true, false, true, queue, index), { initialProps: { index: 0 } });
    expect(result.current.etaSeconds).toBeNull();
    act(() => { vi.advanceTimersByTime(10000); });
    rerender({ index: 1 });
    // 1 MB took 10 s; 4 MB are left (counting files would say 2 files x 10 s = 20 s)
    expect(result.current.etaSeconds).toBe(40);
    expect(Math.round(result.current.progress)).toBe(33);
  });
});
