import { describe, it, expect, beforeEach } from 'vitest';
import { lastQuotaReset, nextQuotaReset, noteQuotaError, keyQuotaToday } from './keyQuota';

// 29 Oct 2026, 10:00 in Dhaka = 28 Oct 21:00 in Los Angeles (summer time, UTC-7)
const NOW = Date.UTC(2026, 9, 29, 4, 0, 0);

beforeEach(() => localStorage.clear());

describe('keyQuota', () => {
  it('the quota day runs from midnight to midnight Pacific time', () => {
    expect(new Date(lastQuotaReset(NOW)).toISOString()).toBe('2026-10-28T07:00:00.000Z');
    expect(new Date(nextQuotaReset(NOW)).toISOString()).toBe('2026-10-29T07:00:00.000Z');
  });

  it('counts this key\'s requests of the current quota day', () => {
    const log = (tail: string, iso: string) => ({ id: iso, timestamp: iso, source: '', model: 'm', status: 'success', keyTail: tail });
    localStorage.setItem('api_call_logs', JSON.stringify([
      log('AAAA', '2026-10-28T06:59:00.000Z'), log('AAAA', '2026-10-28T08:00:00.000Z'), log('AAAA', '2026-10-29T03:00:00.000Z'), log('BBBB', '2026-10-29T03:00:00.000Z'),
    ]));
    expect(keyQuotaToday('AAAA', NOW)).toEqual({ requests: 2, exhausted: [] });
  });

  it('remembers a used-up daily quota until Gemini says it comes back; per-minute limits are not kept', () => {
    noteQuotaError('AAAA', 'gemini-3.8-flash', { status: 429, message: 'PerMinute', error: { retryDelay: '30s' } }, NOW);
    expect(keyQuotaToday('AAAA', NOW).exhausted).toEqual([]);
    noteQuotaError('AAAA', 'gemini-3.8-flash', { status: 429, message: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier. Please retry in 62392s.' }, NOW);
    expect(keyQuotaToday('AAAA', NOW).exhausted).toEqual([{ tail: 'AAAA', model: 'gemini-3.8-flash', resetAt: NOW + 62392000 }]);
    expect(keyQuotaToday('AAAA', NOW + 62392001).exhausted).toEqual([]);
    expect(keyQuotaToday('BBBB', NOW).exhausted).toEqual([]);
  });
});
