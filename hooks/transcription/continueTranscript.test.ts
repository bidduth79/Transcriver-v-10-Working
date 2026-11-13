import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_MORE_SPEECH } from '../../constants/instructions';

// Each request for the rest takes the next answer here (null: the request fails)
const m = vi.hoisted(() => ({ rests: [] as (string | null)[], asked: [] as { from?: string; model: string }[] }));
vi.mock('./transcribeOnce', () => ({
  transcribeOnce: async (_blob: Blob, _mime: string, _seconds: number, options: { continueFrom?: string; modelName: string }) => {
    m.asked.push({ from: options.continueFrom, model: options.modelName });
    const text = m.rests.shift();
    if (text === null || text === undefined) throw new Error('request failed');
    return { text, requests: 1, finishReason: 'STOP', emptyReason: undefined, source: 'Main', keyLabel: 'Main …KEY', model: options.modelName };
  },
}));

import { continueUntilEnd } from './continueTranscript';

// Made-up words from a fixed seed: talk from different seeds shares almost no letter sequences
const talk = (seed: number, words: number) => {
  let state = seed;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return Array.from({ length: words }, () =>
    Array.from({ length: 4 + (next() % 5) }, () => 'abcdefghijklmnopqrstuvwxyz'[next() % 26]).join('')).join(' ');
};
// The same talk with every tenth word heard differently, as when the model transcribes it again
const heardAgain = (text: string) => text.split(' ').map((word, i) => (i % 10 === 9 ? talk(1000 + i, 1) : word)).join(' ');

const first = (text: string) => ({ text, requests: 1, finishReason: 'STOP', emptyReason: undefined, source: 'Main', keyLabel: 'Main …KEY', model: 'gemini-3.8-flash' });
const options = () => ({ provider: { key: 'KEY', source: 'Main' }, modelName: 'gemini-3.8-flash', mode: 'pro' as const, lang: 'en' as const, setStage: vi.fn(), addToast: vi.fn() });
const audio = new Blob(['x']);

beforeEach(() => { m.rests = []; m.asked = []; });

describe('continueUntilEnd', () => {
  it('does not ask for the rest when a long last paragraph already reaches the end of the audio', async () => {
    const text = `[00:00] **S1:** ${talk(1, 30)}\n[01:40] **S1:** ${talk(2, 600)}`;
    const result = await continueUntilEnd(audio, 'audio/ogg', 445, first(text), options());
    expect(m.asked).toHaveLength(0);
    expect(result).toMatchObject({ text, requests: 1 });
  });

  it('joins new speech, and asks again until the words reach the end', async () => {
    const text = `[00:00] **S1:** ${talk(1, 40)}`;
    const [second, third] = [`[12:00] **S2:** ${talk(2, 200)}`, `[25:00] **S1:** ${talk(3, 200)}`];
    m.rests = [second, third];
    const opts = options();
    const result = await continueUntilEnd(audio, 'audio/ogg', 1800, first(text), opts);
    expect(m.asked.map(a => a.from)).toEqual(['00:00', '12:00']);
    expect(result).toMatchObject({ text: `${text}\n${second}\n${third}`, requests: 3 });
    expect(opts.setStage).toHaveBeenCalledWith('The transcript stopped at [12:00]; transcribing the rest...');
    expect(opts.addToast).not.toHaveBeenCalled();
  });

  it('leaves out a rest that repeats the transcript or runs past the end of the audio, counts the request, and warns', async () => {
    const a = talk(1, 80);
    const text = `[00:00] **S1:** ${a}\n[05:00] **S2:** short end`;
    m.rests = [`[05:30] **S1:** ${heardAgain(a)}\n[31:00] **S2:** ${talk(8, 40)}`];
    const opts = options();
    const result = await continueUntilEnd(audio, 'audio/ogg', 1800, first(text), opts);
    expect(m.asked).toEqual([{ from: '05:00', model: 'gemini-3.8-flash' }]);
    expect(result).toMatchObject({ text, requests: 2 });
    expect(opts.addToast).toHaveBeenCalledWith('The transcript stops at [05:00] although the audio goes on to [30:00]. Try transcribing it again.', 'warning');
  });

  it('stops asking, without a warning, when the model says nothing more is spoken', async () => {
    const text = `[00:00] **S1:** ${talk(1, 40)}`;
    m.rests = [NO_MORE_SPEECH];
    const opts = options();
    expect(await continueUntilEnd(audio, 'audio/ogg', 1800, first(text), opts)).toMatchObject({ text, requests: 2 });
    expect(m.asked).toHaveLength(1);
    expect(opts.addToast).not.toHaveBeenCalled();
  });

  it('counts a request for the rest that failed, and keeps what was written', async () => {
    const text = `[00:00] **S1:** ${talk(1, 40)}`;
    m.rests = [null];
    expect(await continueUntilEnd(audio, 'audio/ogg', 1800, first(text), options())).toMatchObject({ text, requests: 2 });
  });

  it('leaves normal mode (no timestamps) as it is', async () => {
    await continueUntilEnd(audio, 'audio/ogg', 1800, first('plain text'), { ...options(), mode: 'normal' as const });
    expect(m.asked).toHaveLength(0);
  });
});
