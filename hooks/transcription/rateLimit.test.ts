import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ setActive: vi.fn(), fallbacks: [] as any[] }));
vi.mock('../../services/ApiKeyManager', () => ({
  getFallbackProviders: vi.fn(async () => m.fallbacks),
  setActiveApiKey: m.setActive,
  getModelDefinition: () => ({ category: 'fast' }),
  isSpeedOptimizationEnabled: () => false,
}));

import { parseRateLimit, rateLimitWaitMs } from './rateLimit';
import { generateWithRecovery } from './geminiTranscriptionRunner';

// The shape @google/genai gives for a 429: the JSON body is in the message
const geminiError = (quotaId: string, retryDelay?: string) => Object.assign(new Error(JSON.stringify({
  error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota', details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId }] },
    ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
  ] },
})), { status: 429 });

describe('parseRateLimit', () => {
  it('tells per-minute limits (wait) from daily ones (switch key or pause)', () => {
    const minute = parseRateLimit(geminiError('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '37s'));
    expect(minute).toEqual({ isRateLimit: true, isDaily: false, retryAfterMs: 37000 });
    expect(rateLimitWaitMs(minute)).toBe(38000);
    const daily = parseRateLimit(geminiError('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '3600s'));
    expect(daily).toMatchObject({ isRateLimit: true, isDaily: true });
    expect(rateLimitWaitMs(daily)).toBeNull();
    expect(rateLimitWaitMs(parseRateLimit(new Error('429 Too Many Requests')))).toBe(31000);
    expect(parseRateLimit(new Error('500 internal')).isRateLimit).toBe(false);
  });
});

describe('generateWithRecovery on rate limits', () => {
  const calls: string[] = [];
  const run = (outcomes: Record<string, any[]>) => generateWithRecovery({
    provider: { key: 'KEY-A', source: 'Primary' },
    buildRequest: async (ai: any, key: string) => {
      ai.models = { generateContent: async () => { calls.push(key); const next = outcomes[key].shift(); if (next instanceof Error) throw next; return next; } };
      return { model: 'gemini-3.8-flash', contents: [], config: {} };
    },
    lang: 'en', setStage: vi.fn(), addToast: vi.fn(),
  });

  beforeEach(() => { calls.length = 0; m.fallbacks = [{ id: 'k2', key: 'KEY-B', source: 'Backup' }]; vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); m.setActive.mockClear(); });

  it('waits as long as Gemini asks on a per-minute limit and retries the same key', async () => {
    const p = run({ 'KEY-A': [geminiError('PerMinute', '20s'), { text: 'ok' }], 'KEY-B': [] });
    await vi.advanceTimersByTimeAsync(20999);
    expect(calls).toEqual(['KEY-A']);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).response).toEqual({ text: 'ok' });
    expect(calls).toEqual(['KEY-A', 'KEY-A']);
  });

  it('after waiting, uses another key without making it the default', async () => {
    const p = run({ 'KEY-A': [geminiError('PerMinute', '5s'), geminiError('PerMinute', '5s')], 'KEY-B': [{ text: 'b' }] });
    await vi.advanceTimersByTimeAsync(6000);
    expect(await p).toMatchObject({ apiKey: 'KEY-B', response: { text: 'b' } });
    expect(m.setActive).not.toHaveBeenCalled();
  });

  it('switches key at once, and keeps it, when the daily quota is used up', async () => {
    const p = run({ 'KEY-A': [geminiError('GenerateRequestsPerDayPerProjectPerModel')], 'KEY-B': [{ text: 'b' }] });
    expect(await p).toMatchObject({ apiKey: 'KEY-B' });
    expect(calls).toEqual(['KEY-A', 'KEY-B']);
    expect(m.setActive).toHaveBeenCalledWith('k2');
  });
});
