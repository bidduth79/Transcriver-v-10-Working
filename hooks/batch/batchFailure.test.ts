import { describe, it, expect } from 'vitest';
import { planAfterFailure, BUSY_WAITS_MS } from './batchFailure';

const perMinute = { isRateLimit: true, isDaily: false, retryAfterMs: 20000 };
const daily = { isRateLimit: true, isDaily: true, retryAfterMs: null };

describe('planAfterFailure', () => {
  it('waits 2, 5 and 10 minutes for a busy server, then pauses the batch instead of failing the file', () => {
    expect(BUSY_WAITS_MS).toEqual([120000, 300000, 600000]);
    expect(planAfterFailure('busy', undefined, 0)).toEqual({ action: 'retry', waitMs: 120000, busy: true });
    expect(planAfterFailure('busy', undefined, 2)).toEqual({ action: 'retry', waitMs: 600000, busy: true });
    expect(planAfterFailure('busy', undefined, 3)).toEqual({ action: 'pause', why: 'busy' });
  });

  it('never tries a refused audio again', () => {
    expect(planAfterFailure('refused', undefined, 0)).toEqual({ action: 'fail' });
  });

  it('pauses when every key has used its daily quota', () => {
    expect(planAfterFailure('other', daily, 0)).toEqual({ action: 'pause', why: 'quota' });
  });

  it('tries any other failure once more: after 3 seconds, or after the wait Gemini asked for', () => {
    expect(planAfterFailure('other', undefined, 0)).toEqual({ action: 'retry', waitMs: 3000, busy: false });
    expect(planAfterFailure(undefined, perMinute, 0)).toEqual({ action: 'retry', waitMs: 21000, busy: false });
    expect(planAfterFailure('other', undefined, 1)).toEqual({ action: 'fail' });
  });
});
