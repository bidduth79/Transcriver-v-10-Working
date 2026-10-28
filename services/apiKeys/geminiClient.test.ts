import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ logged: [] as any[], next: null as any, queue: [] as any[], models: [] as string[], configs: [] as any[] }));
vi.mock('./geminiTransport', () => ({
  requestGenerateContent: async (_apiKey: string, p: any) => {
    m.models.push(p.model);
    m.configs.push(p.config);
    const next = m.queue.length ? m.queue.shift() : m.next;
    // 'hang': never answers, like an overloaded model, until the request is cancelled
    if (next === 'hang') return new Promise((_, reject) => p.config.abortSignal.addEventListener('abort', () => reject(new Error('aborted'))));
    // 'hangEmpty': the same, but the cancelled request comes back as an empty answer instead of an error
    if (next === 'hangEmpty') return new Promise(resolve => p.config.abortSignal.addEventListener('abort', () => resolve({ candidates: [] })));
    if (next instanceof Error) throw next;
    return next;
  },
  requestUploadFile: vi.fn(),
  requestGetFile: vi.fn(),
  requestDeleteFile: vi.fn(),
}));
vi.mock('./apiCallStats', () => ({ logApiCall: (e: any) => m.logged.push(e) }));

import { createGeminiClient } from './geminiClient';
import { pacificDayStart, pacificDayIndex } from '../../components/modals/quota/pacificDay';

beforeEach(() => { m.logged = []; m.queue = []; m.models = []; m.configs = []; });

describe('createGeminiClient', () => {
  it('logs every request with Gemini token counts and the key tail', async () => {
    const ai = await createGeminiClient('SECRET-KEY-WXYZ');
    m.next = { text: 'ok', usageMetadata: { promptTokenCount: 4100, totalTokenCount: 4500 } };
    expect(await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' })).toBe(m.next);
    m.next = Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), { status: 429 });
    await expect(ai.models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' })).rejects.toThrow();
    m.next = new Error('500 internal');
    await expect(ai.models.generateContent({ model: 'gemini-3.5-flash', contents: 'x' })).rejects.toThrow();
    expect(m.logged.map(({ latency: _l, ...e }) => e)).toEqual([
      { status: 'success', model: 'gemini-3.8-flash', keyTail: 'WXYZ', promptTokens: 4100, tokens: 4500 },
      { status: 'error', model: 'gemini-3.8-flash', keyTail: 'WXYZ', rateLimited: true },
      { status: 'error', model: 'gemini-3.5-flash', keyTail: 'WXYZ', rateLimited: false },
    ]);
    expect(JSON.stringify(m.logged)).not.toContain('SECRET');
  });
});

describe('busy model (503)', () => {
  const busy = () => Object.assign(new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'), { status: 503 });

  it('waits 2 s and 6 s, then succeeds on the same model', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    m.queue = [busy(), busy(), { text: 'ok' }];
    const p = (await createGeminiClient('KEY-1234')).models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' });
    await vi.advanceTimersByTimeAsync(7999);
    expect(m.models).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ text: 'ok' });
    expect(m.models).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
    vi.useRealTimers();
  });

  it('then uses a similar model on the same key, and gives up on other errors at once', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    m.queue = [busy(), busy(), busy(), { text: 'from 3.5' }];
    const p = (await createGeminiClient('KEY-1234')).models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' });
    await vi.advanceTimersByTimeAsync(8000);
    expect(await p).toEqual({ text: 'from 3.5' });
    expect(m.models.at(-1)).toBe('gemini-3.5-flash');
    expect(m.logged.map(l => [l.model, l.status])).toEqual([
      ['gemini-3.8-flash', 'error'], ['gemini-3.8-flash', 'error'], ['gemini-3.8-flash', 'error'], ['gemini-3.5-flash', 'success'],
    ]);
    m.models = []; m.queue = [new Error('400 bad request')];
    await expect((await createGeminiClient('K')).models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' })).rejects.toThrow('400');
    expect(m.models).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe('request time limit', () => {
  it('cancels a text request with no answer after 90 s and treats it as busy', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    m.queue = ['hang', 'hang', 'hang', { text: 'fallback' }];
    const p = (await createGeminiClient('K')).models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' });
    await vi.advanceTimersByTimeAsync(90000);
    expect(m.models).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000 + 90000 + 6000 + 90000);
    expect(await p).toEqual({ text: 'fallback' });
    expect(m.models).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']);
    vi.useRealTimers();
  });

  it('treats a cancelled request that comes back empty as a timeout, not as an answer', async () => {
    vi.useFakeTimers();
    m.queue = ['hangEmpty', { text: 'second try' }];
    const p = (await createGeminiClient('K')).models.generateContent({ model: 'gemini-3.8-flash', contents: 'x' });
    await vi.advanceTimersByTimeAsync(90000 + 2000);
    expect(await p).toEqual({ text: 'second try' });
    expect(m.logged[0]).toMatchObject({ status: 'error' });
    vi.useRealTimers();
  });

  it('gives audio requests up to 10 minutes', async () => {
    vi.useFakeTimers();
    m.queue = ['hang'];
    let settled = false;
    const contents = [{ role: 'user', parts: [{ fileData: { fileUri: 'u', mimeType: 'audio/mpeg' } }] }];
    (await createGeminiClient('K')).models.generateContent({ model: 'gemini-3.5-flash-lite', contents }).catch(() => {}).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(599000);
    expect(settled).toBe(false);
    expect(m.logged).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.logged[0]).toMatchObject({ status: 'error', model: 'gemini-3.5-flash-lite' });
    vi.useRealTimers();
  });

  it("uses a request's own time limit and does not send it to Gemini", async () => {
    vi.useFakeTimers();
    m.queue = ['hang'];
    const contents = [{ role: 'user', parts: [{ fileData: { fileUri: 'u', mimeType: 'audio/ogg' } }] }];
    let settled = false;
    (await createGeminiClient('K')).models.generateContent({ model: 'gemini-3.5-flash-lite', contents, config: { temperature: 0.35, timeoutMs: 300000 } })
      .catch(() => {}).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(299000);
    expect(settled).toBe(false);
    expect(m.configs[0]).not.toHaveProperty('timeoutMs');
    expect(m.configs[0].temperature).toBe(0.35);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.logged[0]).toMatchObject({ status: 'error' });
    vi.useRealTimers();
  });
});

describe('pacific quota day', () => {
  it('starts at midnight Pacific time, in summer and in winter', () => {
    // 23 Oct 2026, 13:30 in Dhaka = 07:30 UTC = 00:30 PDT (UTC-7)
    expect(new Date(pacificDayStart(Date.UTC(2026, 9, 23, 7, 30))).toISOString()).toBe('2026-10-23T07:00:00.000Z');
    // 06:59 UTC is still the previous Pacific day
    expect(new Date(pacificDayStart(Date.UTC(2026, 9, 23, 6, 59))).toISOString()).toBe('2026-10-22T07:00:00.000Z');
    // In winter (PST, UTC-8) midnight is 08:00 UTC
    expect(new Date(pacificDayStart(Date.UTC(2026, 11, 1, 9, 0))).toISOString()).toBe('2026-12-01T08:00:00.000Z');
    expect(pacificDayIndex(Date.UTC(2026, 9, 23, 7, 30)) - pacificDayIndex(Date.UTC(2026, 9, 23, 6, 59))).toBe(1);
  });
});
