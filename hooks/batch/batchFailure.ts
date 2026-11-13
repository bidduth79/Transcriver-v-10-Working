// What a batch does with a file that failed. A busy server is waited for with growing pauses and the same file is
// tried again; in the app's logs one busy spell failed 21 files in a row, two quick tries each. When it stays
// busy the batch pauses at that file instead of failing the rest. A refused audio is not tried again at all.
import { rateLimitWaitMs, type RateLimitInfo } from '../transcription/rateLimit';
import type { FailureKind } from '../transcription/transcriptionErrors';

// Held by the tab that is transcribing a batch file; the other tabs look again this often
export const BATCH_FILE_LOCK = 'transcriver-batch-file';
export const OTHER_TAB_WAIT_MS = 15_000;

// Waits before trying the same file again while the server is busy
export const BUSY_WAITS_MS = [2, 5, 10].map(minutes => minutes * 60_000);
const QUICK_RETRY_MS = 3000;

export type FailurePlan =
  // Every key's daily quota is used up, or the server stayed busy: stop at this file, kept for resume
  | { action: 'pause'; why: 'quota' | 'busy' }
  | { action: 'retry'; waitMs: number; busy: boolean }
  | { action: 'fail' };

export const planAfterFailure = (kind: FailureKind | undefined, limit: RateLimitInfo | undefined, retryCount: number): FailurePlan => {
  if (limit?.isDaily) return { action: 'pause', why: 'quota' };
  if (kind === 'refused') return { action: 'fail' };
  if (kind === 'busy') {
    return retryCount < BUSY_WAITS_MS.length ? { action: 'retry', waitMs: BUSY_WAITS_MS[retryCount], busy: true } : { action: 'pause', why: 'busy' };
  }
  return retryCount < 1 ? { action: 'retry', waitMs: (limit && rateLimitWaitMs(limit)) || QUICK_RETRY_MS, busy: false } : { action: 'fail' };
};
