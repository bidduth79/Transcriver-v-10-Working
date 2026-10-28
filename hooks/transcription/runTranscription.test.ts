import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ parts: null as { blob: Blob; startSeconds: number }[] | null, running: 0, maxRunning: 0, cleanups: 0, asked: {} as Record<string, number> }));

vi.mock('./audioChunks', () => ({ planAudioChunks: vi.fn(async () => m.parts) }));
vi.mock('./geminiAudioSource', () => ({
  createAudioSource: (blob: Blob) => ({ partFor: async () => ({ name: (blob as File).name }), cleanup: () => { m.cleanups++; } }),
}));
vi.mock('./geminiRequest', () => ({
  buildTranscriptionRequest: (_model: string, _mode: string, part: { name: string }) => part,
  extractResponseText: (resp: { text?: string } | null) => resp?.text ?? '',
}));
vi.mock('./geminiTranscriptionRunner', () => ({
  // Answers "[00:10] <part name>" after a short wait, so parts overlap in time
  generateWithRecovery: async ({ buildRequest }: { buildRequest: (ai: unknown, key: string) => Promise<{ name: string }> }) => {
    const part = await buildRequest({}, 'KEY');
    m.running++;
    m.maxRunning = Math.max(m.maxRunning, m.running);
    await new Promise(resolve => setTimeout(resolve, 5));
    m.running--;
    m.asked[part.name] = (m.asked[part.name] ?? 0) + 1;
    // 'empty' never answers with text; 'flaky' answers only the second time; 'other' answers on fallback (3rd try)
    if (part.name === 'empty' || (part.name === 'flaky' && m.asked.flaky === 1)) return { response: { text: '', candidates: [] }, ai: {}, apiKey: 'KEY', source: 'Main', keyLabel: 'Main …KEY' };
    if (part.name === 'other' && m.asked.other <= 2) return { response: { text: '', candidates: [{ finishReason: 'OTHER' }] }, ai: {}, apiKey: 'KEY', source: 'Main', keyLabel: 'Main …KEY' };
    const text = `[00:10] **Speaker 1:** ${part.name}`;
    return { response: { text, candidates: [{ finishReason: 'STOP' }] }, ai: {}, apiKey: 'KEY', source: 'Main', keyLabel: 'Main …KEY' };
  },
}));

import { transcribeAudio } from './runTranscription';

const named = (name: string) => new File(['x'], name, { type: 'audio/wav' });
const options = () => ({ provider: { key: 'KEY', source: 'Main' }, modelName: 'gemini-3.8-flash', mode: 'pro' as const, lang: 'en' as const, setStage: vi.fn(), addToast: vi.fn() });

beforeEach(() => { m.parts = null; m.running = 0; m.maxRunning = 0; m.cleanups = 0; m.asked = {}; });

describe('transcribeAudio', () => {
  it('sends a short recording as one request', async () => {
    const opts = options();
    const result = await transcribeAudio(named('whole'), 'audio/wav', 600, opts);
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** whole', finishReason: 'STOP', keyLabel: 'Main …KEY' });
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

  it('asks once more, the same way, when an answer comes back empty', async () => {
    const result = await transcribeAudio(named('flaky'), 'audio/wav', 600, options());
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** flaky', requests: 2, parts: 1 });
    expect(m.asked.flaky).toBe(2);
  });

  it('recovers with fallback model and clean config when finishReason OTHER persists twice', async () => {
    const result = await transcribeAudio(named('other'), 'audio/wav', 600, options());
    expect(result).toMatchObject({ text: '[00:10] **Speaker 1:** other', requests: 3, parts: 1 });
    expect(m.asked.other).toBe(3);
  });

  it('reports an empty answer as an error instead of "no speech", and never leaves a silent gap', async () => {
    const single = await transcribeAudio(named('empty'), 'audio/wav', 600, options());
    expect(single).toMatchObject({ text: '', emptyReason: 'NO_ANSWER', requests: 2 });
    m.parts = [named('p1'), named('empty')].map((blob, i) => ({ blob, startSeconds: i * 840 }));
    await expect(transcribeAudio(named('long'), 'audio/wav', 1680, options())).rejects.toThrow('Gemini returned no text (part 2 of 2). Reason: NO_ANSWER');
  });
});
