import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@google/genai', () => ({ GoogleGenAI: class { constructor(public opts: { apiKey: string }) {} } }));

import { abortWhenClientLeaves, runWithKey } from './geminiServer';
import { loadEnvKeys, getEnvKeys, envKeyToken } from './envKeys';

// A stand-in for Express's response: 'close' fires when the connection ends, finished or not
const response = (finished: boolean) => Object.assign(new EventEmitter(), { writableEnded: finished }) as never;

beforeEach(() => { process.env.GEMINI_API_KEY = 'SERVER-KEY'; loadEnvKeys('no-such-file.env'); });
afterEach(() => { delete process.env.GEMINI_API_KEY; });

describe('server Gemini helpers', () => {
  it('cancels the Gemini request when the browser stops waiting, but not after a normal answer', () => {
    const left = response(false);
    const leftSignal = abortWhenClientLeaves(left);
    (left as unknown as EventEmitter).emit('close');
    expect(leftSignal.aborted).toBe(true);

    const answered = response(true);
    const answeredSignal = abortWhenClientLeaves(answered);
    (answered as unknown as EventEmitter).emit('close');
    expect(answeredSignal.aborted).toBe(false);
  });

  it('uses only the requested key: a browser key as sent, a .env token as its key, no silent second try', async () => {
    const keys: string[] = [];
    const op = async (ai: { opts: { apiKey: string } }) => {
      keys.push(ai.opts.apiKey);
      if (ai.opts.apiKey === 'USER-KEY') throw new Error('503 UNAVAILABLE');
      return 'ok';
    };
    await expect(runWithKey('USER-KEY', op as never)).rejects.toThrow('503');
    expect(keys).toEqual(['USER-KEY']);

    keys.length = 0;
    expect(await runWithKey('SERVER_KEY', op as never)).toBe('ok');
    expect(await runWithKey(envKeyToken(getEnvKeys()[0]), op as never)).toBe('ok');
    expect(keys).toEqual(['SERVER-KEY', 'SERVER-KEY']);
    await expect(runWithKey('env:env-99:abcd', op as never)).rejects.toThrow('no longer in .env');
  });
});
