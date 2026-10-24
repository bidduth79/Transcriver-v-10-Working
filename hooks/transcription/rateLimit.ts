/**
 * Reads a Gemini "429 / RESOURCE_EXHAUSTED" error. The error body lists which quota ran out
 * (QuotaFailure, e.g. "...PerMinute..." or "...PerDay...") and how long to wait (RetryInfo "37s").
 * A per-minute limit is worth waiting for on the same key; a daily one is not (it resets at
 * midnight Pacific time), so another key or a pause is needed instead.
 */
export interface RateLimitInfo {
  isRateLimit: boolean;
  isDaily: boolean;
  retryAfterMs: number | null;
}

// Longest wait before retrying the same key; longer suggested waits are treated like a daily limit
export const MAX_RATE_LIMIT_WAIT_MS = 120_000;
const DEFAULT_WAIT_MS = 30_000;

// The parts of an SDK / HTTP error that describe a quota problem
type ErrorLike = { message?: unknown; status?: unknown; error?: unknown } | null | undefined;

const errorText = (err: unknown): string => {
  if (typeof err === 'string') return err;
  const e = err as ErrorLike;
  try {
    return [e?.message, e?.status, JSON.stringify(e?.error ?? '')].filter(Boolean).join(' ');
  } catch {
    return String(e?.message ?? '');
  }
};

export const parseRateLimit = (err: unknown): RateLimitInfo => {
  const text = errorText(err);
  const isRateLimit = (err as ErrorLike)?.status === 429 || /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(text);
  if (!isRateLimit) return { isRateLimit: false, isDaily: false, retryAfterMs: null };

  const delay = text.match(/retryDelay["\s:]+"?(\d+(?:\.\d+)?)s/i) || text.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  const retryAfterMs = delay ? Math.ceil(parseFloat(delay[1]) * 1000) : null;
  const isDaily = /PerDay|per day|daily/i.test(text) || (retryAfterMs !== null && retryAfterMs > MAX_RATE_LIMIT_WAIT_MS);
  return { isRateLimit, isDaily, retryAfterMs };
};

// How long to wait before trying the same key again (per-minute limits only)
export const rateLimitWaitMs = (info: RateLimitInfo) =>
  !info.isRateLimit || info.isDaily ? null : Math.min(info.retryAfterMs ?? DEFAULT_WAIT_MS, MAX_RATE_LIMIT_WAIT_MS) + 1000;

export const sleepMs = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
