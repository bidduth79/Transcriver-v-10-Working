import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ parts: null as { blob: Blob; startSeconds: number }[] | null, running: 0, maxRunning: 0, cleanups: 0, asked: {} as Record<string, number>, models: [] as string[], clean: [] as boolean[] }));

// The answers here are short English stand-ins; only an answer saying so counts as "not a transcript"
vi.mock('./answerCheck', () => ({ isNotATranscript: (text: string) => text.includes('describes its work') }));
vi.mock('./audioChunks', () => ({ planAudioChunks: vi.fn(async () => m.parts) }));
vi.mock('./geminiAudioSource', () => ({
  createAudioSource: (blob: Blob) => ({ partFor: async () => ({ name: (blob as File).name }), cleanup: () => { m.cleanups++; } }),
}));
vi.mock('./geminiRequest', () => ({
  // A request for the rest of a transcript is named "<part>@<time>"
  buildTranscriptionRequest: (model: string, _mode: string, part: { name: string }, clean?: boolean, from?: string) => {
    m.models.push(model);
    m.clean.push(!!clean);
    return { name: from ? `${part.name}@${from}` : part.name, model };
  },
  extractResponseText: (resp: { text?: string } | null) => resp?.text ?? '',
  transcriptionTimeoutMs: () => undefined,
}));
vi.mock('./geminiTranscriptionRunner', () => ({
  // Answers after a short wait, so parts overlap in time
  generateWithRecovery: async ({ buildRequest }: { buildRequest: (ai: unknown, key: string) => Promise<{ name: string; model: string }> }) => {
    const request = await buildRequest({}, 'KEY');
    m.running++;
    m.maxRunning = Math.max(m.maxRunning, m.running);
    await new Promise(resolve => setTimeout(resolve, 5));
    m.running--;
    const asked = m.asked[request.name] = (m.asked[request.name] ?? 0) + 1;
    const reply = (response: object) => ({ response, ai: {}, apiKey: 'KEY', source: 'Main', keyLabel: 'Main …KEY' });
    const answer = (text: string) => reply({ text, candidates: [{ finishReason: 'STOP' }] });
    // 'empty' never answers with text; 'flaky' answers only the second time; 'blocked' is refused
    if (request.name === 'empty' || (request.name === 'flaky' && asked === 1)) return reply({ text: '', candidates: [] });
    if (request.name === 'blocked') return reply({ text: '', promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } });
    // 'describe' first answers with a description of its work instead of the words, then with the words
    if ((request.name === 'describe' && asked === 1) || request.name === 'describe-always') return answer('A transcription that describes its work.');
    // 'loop' goes round in a loop the first time only
    if (request.name === 'loop' && asked === 1) return answer(`[00:00] **Speaker 1:** ${Array(8).fill(LOOP_ROUND).join(' ')}`);
    return answer(BREAK_ANSWERS[request.name] ?? `[00:10] **Speaker 1:** ${request.name}`);
  },
}));

import { transcribeAudio } from './runTranscription';

// 'break' stops at a programme's break; asked for the rest, it repeats a little and goes on to the end
const BREAK_ANSWERS: Record<string, string> = {
  break: '[00:10] **Speaker 1:** before\n[26:35] **Speaker 1:** a short break',
  'break@26:35': '[26:35] **Speaker 1:** a short break\n[28:20] **Speaker 2:** after the break\n[46:50] **Speaker 2:** the end',
};
// Made-up words that the looping answer says again and again
const LOOP_ROUND = Array.from({ length: 60 }, (_, i) => `word${String.fromCharCode(97 + (i * 7) % 26)}${String.fromCharCode(97 + (i * 11) % 26)}${i}`).join(' ');

const named = (name: string) => new File(['x'], name, { type: 'audio/wav' });
const options = () => ({ provider: { key: 'KEY', source: 'Main' }, modelName: 'gemini-3.8-flash', mode: 'pro' as const, lang: 'en' as const, setStage: vi.fn(), addToast: vi.fn() });

beforeEach(() => { m.parts = null; m.running = 0; m.maxRunning = 0; m.cleanups = 0; m.asked = {}; m.models = []; m.clean = []; });

describe('transcribeAudio', () => {
  it('sends a short recording as one request', async () => {
    const opts = options();
    const result = await transcribeAudio(named('whole'), 'audio/wav', 60, opts);
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** whole', finishReason: 'STOP', keyLabel: 'Main …KEY', model: 'gemini-3.8-flash', requests: 1 });
    expect(opts.setStage).toHaveBeenCalledWith('Transcribing media on AI server...');
    expect(m.cleanups).toBe(1);
  });

  it('transcribes parts two at a time and joins them in order with shifted timestamps', async () => {
    m.parts = [named('p1'), named('p2'), named('p3')].map((blob, i) => ({ blob, startSeconds: i * 840 }));
    const opts = options();
    const result = await transcribeAudio(named('long'), 'audio/wav', 2520, opts);
    expect(result.text).toBe('[00:10] **Speaker 1:** p1\n[14:10] **Speaker 1:** p2\n[28:10] **Speaker 1:** p3');
    expect(m.maxRunning).toBe(2);
    expect(m.cleanups).toBe(3);
    expect(opts.setStage).toHaveBeenLastCalledWith('Transcribing a long recording in 3 parts (3/3 done)...');
  });

  it('asks the same model once more, with its default settings, when an answer comes back empty', async () => {
    const opts = options();
    const result = await transcribeAudio(named('flaky'), 'audio/wav', 60, opts);
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** flaky', requests: 2, parts: 1, model: 'gemini-3.8-flash' });
    expect(m.models).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash']);
    expect(m.clean).toEqual([false, true]);
    expect(opts.setStage).toHaveBeenCalledWith('The answer was empty; asking once more...');
  });

  it('reports an empty answer as an error instead of "no speech", and never leaves a silent gap', async () => {
    const single = await transcribeAudio(named('empty'), 'audio/wav', 60, options());
    expect(single).toMatchObject({ text: '', emptyReason: 'NO_ANSWER', requests: 2 });
    m.parts = [named('p1'), named('empty')].map((blob, i) => ({ blob, startSeconds: i * 840 }));
    await expect(transcribeAudio(named('long'), 'audio/wav', 1680, options())).rejects.toThrow('Gemini returned no text (part 2 of 2). Reason: NO_ANSWER');
  });

  it('does not ask again when the answer was refused, since that would not change', async () => {
    expect(await transcribeAudio(named('blocked'), 'audio/wav', 60, options())).toMatchObject({ text: '', emptyReason: 'PROHIBITED_CONTENT', requests: 1 });
  });

  it('asks again when the answer is not a transcript, and never saves such an answer', async () => {
    const fixed = await transcribeAudio(named('describe'), 'audio/ogg', 60, options());
    expect(fixed).toMatchObject({ text: '[00:10] **Speaker 1:** describe', requests: 2 });
    const failed = await transcribeAudio(named('describe-always'), 'audio/ogg', 60, options());
    expect(failed).toMatchObject({ text: '', emptyReason: 'NOT_A_TRANSCRIPT', requests: 2 });
  });

  it('asks the same model again when an answer goes round in a loop, and keeps the good answer', async () => {
    const opts = options();
    const result = await transcribeAudio(named('loop'), 'audio/ogg', 60, opts);
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** loop', requests: 2, model: 'gemini-3.8-flash' });
    expect(m.models).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash']);
    expect(opts.setStage).toHaveBeenCalledWith('The answer wrote the same words over and over; asking once more...');
  });

  it('asks for the rest when the transcript stops at a break in the middle, and joins it without repeats', async () => {
    const opts = options();
    const result = await transcribeAudio(named('break'), 'audio/ogg', 2832, opts);
    expect(result.text).toBe('[00:10] **Speaker 1:** before\n[26:35] **Speaker 1:** a short break\n[28:20] **Speaker 2:** after the break\n[46:50] **Speaker 2:** the end');
    expect(result.requests).toBe(2);
    expect(opts.setStage).toHaveBeenCalledWith('The transcript stopped at [26:35]; transcribing the rest...');
    expect(opts.addToast).not.toHaveBeenCalled();
  });

  it('never swaps a transcribe model for another: its transcript is kept as it came', async () => {
    await transcribeAudio(named('break'), 'audio/ogg', 2832, { ...options(), modelName: 'gemini-3.5-transcribe' });
    expect(m.models).toEqual(['gemini-3.5-transcribe']);
  });

  it('warns when the rest cannot be had, and keeps what was written', async () => {
    const opts = options();
    const result = await transcribeAudio(named('stuck'), 'audio/ogg', 600, opts);
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** stuck', requests: 2 });
    expect(opts.addToast).toHaveBeenCalledWith('The transcript stops at [00:10] although the audio goes on to [10:00]. Try transcribing it again.', 'warning');
  });

  it('normal mode (no timestamps) is left as it is', async () => {
    await transcribeAudio(named('break'), 'audio/ogg', 2832, { ...options(), mode: 'normal' as const });
    expect(m.models).toHaveLength(1);
  });

  it('uses the chosen model as it is, also flash-lite on long audio', async () => {
    const opts = { ...options(), modelName: 'gemini-3.5-flash-lite' };
    const result = await transcribeAudio(named('whole'), 'audio/ogg', 50 * 60, { ...opts, mode: 'normal' as const });
    expect(m.models).toEqual(['gemini-3.5-flash-lite']);
    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(opts.addToast).not.toHaveBeenCalled();
  });
});
