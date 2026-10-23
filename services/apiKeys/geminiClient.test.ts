import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ logged: [] as any[], next: null as any }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: async () => { if (m.next instanceof Error) throw m.next; return m.next; } }; },
}));
vi.mock('./apiCallStats', () => ({ logApiCall: (e: any) => m.logged.push(e) }));

import { createGeminiClient } from './geminiClient';
import { pacificDayStart, pacificDayIndex } from '../../components/modals/quota/pacificDay';

beforeEach(() => { m.logged = []; });

describe('createGeminiClient', () => {
  it('logs every request with Gemini token counts and the key tail', async () => {
    const ai = createGeminiClient('SECRET-KEY-WXYZ');
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
