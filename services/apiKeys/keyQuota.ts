// Each key's use today and its used-up daily quotas, for the Settings key lists.
// Gemini's daily quotas start again at midnight Pacific time (1 or 2 pm in Bangladesh).
import { parseRateLimit } from '../../hooks/transcription/rateLimit';
import type { ApiCallLog } from './apiCallStats';

const EXHAUSTED_STORAGE = 'key_quota_exhausted';
const DAY_MS = 24 * 60 * 60 * 1000;

// When the current Pacific day started
export const lastQuotaReset = (now: number) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(now));
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const sinceMidnight = (value('hour') * 3600 + value('minute') * 60 + value('second')) * 1000;
  return Math.floor((now - sinceMidnight) / 1000) * 1000;
};

export const nextQuotaReset = (now: number) => lastQuotaReset(now) + DAY_MS;

// A used-up daily quota of one key for one model, until `resetAt` (ms)
export interface ExhaustedQuota {
  tail: string;
  model: string;
  resetAt: number;
}

const readExhausted = (): ExhaustedQuota[] => {
  try {
    const list = JSON.parse(localStorage.getItem(EXHAUSTED_STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// Called for every failed request: a daily quota error marks that key and model until the quota comes back
export const noteQuotaError = (tail: string, model: string, err: unknown, now = Date.now()) => {
  const limit = parseRateLimit(err);
  if (!limit.isDaily) return;
  const resetAt = limit.retryAfterMs ? now + limit.retryAfterMs : nextQuotaReset(now);
  const others = readExhausted().filter(q => q.resetAt > now && !(q.tail === tail && q.model === model));
  try {
    localStorage.setItem(EXHAUSTED_STORAGE, JSON.stringify([...others, { tail, model, resetAt }]));
  } catch {
    // Storage full or blocked: the key list just does not show it
  }
};

const readLogs = (): ApiCallLog[] => {
  try {
    const logs = JSON.parse(localStorage.getItem('api_call_logs') || '[]');
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
};

// Requests sent with this key since the quota day began (this browser's requests), and its used-up quotas
export const keyQuotaToday = (tail: string, now = Date.now()) => {
  const since = lastQuotaReset(now);
  const requests = readLogs().filter(log => log.keyTail === tail && new Date(log.timestamp).getTime() >= since).length;
  const exhausted = readExhausted().filter(q => q.tail === tail && q.resetAt > now);
  return { requests, exhausted };
};

// This key's daily quota for this model is used up
export const isQuotaUsedUp = (tail: string, model: string, now = Date.now()) =>
  readExhausted().some(q => q.tail === tail && q.model === model && q.resetAt > now);
