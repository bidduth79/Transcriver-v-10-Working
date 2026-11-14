import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('./geminiClient', () => ({ createGeminiClient: async () => ({ models: { generateContent: m.generate } }) }));

import { checkKey, lastKeyCheck } from './keyCheck';

const error = (status: number, message: string) => Object.assign(new Error(message), { status });

beforeEach(() => { localStorage.clear(); m.generate.mockReset(); });

describe('checkKey', () => {
  it('asks the chosen model one tiny question and keeps the result for the key list', async () => {
    m.generate.mockResolvedValue({ text: 'OK' });
    const result = await checkKey(' AIzaKEY-Dva0 ', 'gemini-3.5-flash', () => 1000);
    expect(result).toEqual({ tail: 'Dva0', status: 'ok', model: 'gemini-3.5-flash', at: 1000 });
    expect(m.generate).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', contents: 'Say OK', config: { maxOutputTokens: 16 } });
    expect(lastKeyCheck('Dva0')).toEqual(result);
  });

  it('tells an invalid key, one without access, a used-up day, a per-minute limit, a busy server and other errors apart', async () => {
    const cases: [Error, string][] = [
      [error(401, 'API key not valid. Please pass a valid API key.'), 'invalid'],
      [error(403, 'The Gemini API free tier is not available for this project'), 'noAccess'],
      [error(429, 'Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier'), 'quotaToday'],
      [error(429, '{"error":{"code":429,"details":[{"quotaId":"PerMinute","retryDelay":"20s"}]}}'), 'rateLimited'],
      [error(503, 'This model is currently experiencing high demand'), 'busy'],
      [error(400, 'bad request'), 'error'],
    ];
    for (const [err, status] of cases) {
      m.generate.mockRejectedValueOnce(err);
      expect((await checkKey('KEY-AAAA', 'gemini-3.5-flash')).status).toBe(status);
    }
    expect(lastKeyCheck('AAAA')).toMatchObject({ status: 'error', message: 'bad request' });
  });
});
