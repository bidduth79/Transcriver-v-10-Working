import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@google/genai', () => ({ GoogleGenAI: class { constructor(public opts: { apiKey: string }) {} } }));

import { abortWhenClientLeaves, runWithServerFallback } from './geminiServer';

// A stand-in for Express's response: 'close' fires when the connection ends, finished or not
const response = (finished: boolean) => Object.assign(new EventEmitter(), { writableEnded: finished }) as never;

beforeEach(() => { process.env.GEMINI_API_KEY = 'SERVER-KEY'; });
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

  it('tries the server key after a failed request, but not once the browser has gone', async () => {
    const keys: string[] = [];
    const op = async (ai: { opts: { apiKey: string } }) => {
      keys.push(ai.opts.apiKey);
      if (ai.opts.apiKey === 'USER-KEY') throw new Error('503 UNAVAILABLE');
      return 'ok';
    };
    expect(await runWithServerFallback('USER-KEY', op as never)).toBe('ok');
    expect(keys).toEqual(['USER-KEY', 'SERVER-KEY']);

    keys.length = 0;
    const controller = new AbortController();
    controller.abort();
    await expect(runWithServerFallback('USER-KEY', op as never, controller.signal)).rejects.toThrow('503');
    expect(keys).toEqual(['USER-KEY']);
  });
});
