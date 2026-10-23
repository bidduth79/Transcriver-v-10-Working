import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./transcriptionUtils', () => ({ blobToBase64: vi.fn(async () => 'BASE64') }));
vi.mock('../../services/ApiKeyManager', () => ({
  getFallbackProviders: vi.fn(async () => [{ id: 'k2', key: 'KEY-B', source: 'Backup' }]),
  setActiveApiKey: vi.fn(),
  getModelDefinition: () => ({ category: 'fast' }),
  isSpeedOptimizationEnabled: () => false,
}));

import { createAudioSource, INLINE_AUDIO_LIMIT } from './geminiAudioSource';
import { generateWithRecovery } from './geminiTranscriptionRunner';
import { buildTranscriptionRequest } from './geminiRequest';

const blobOf = (size: number) => { const b = new Blob(['x']); Object.defineProperty(b, 'size', { value: size }); return b; };
const fakeAi = (key: string, states = ['PROCESSING', 'ACTIVE']) => {
  let n = 0;
  return {
    key,
    files: {
      upload: vi.fn(async () => ({ name: `files/${key}`, uri: `uri://${key}`, state: states[n++] })),
      get: vi.fn(async () => ({ name: `files/${key}`, uri: `uri://${key}`, state: states[n++] })),
      delete: vi.fn(async () => {}),
    },
  } as any;
};

beforeEach(() => { vi.useFakeTimers(); });

describe('createAudioSource', () => {
  it('sends small audio inline without uploading', async () => {
    const ai = fakeAi('A');
    const src = createAudioSource(blobOf(INLINE_AUDIO_LIMIT), 'audio/mpeg');
    expect(await src.partFor(ai, 'A')).toEqual({ inlineData: { mimeType: 'audio/mpeg', data: 'BASE64' } });
    await src.cleanup();
    expect(ai.files.upload).not.toHaveBeenCalled();
    expect(ai.files.delete).not.toHaveBeenCalled();
  });

  it('uploads large audio once per key, waits until ready, and deletes it on cleanup', async () => {
    const ai = fakeAi('A');
    const big = blobOf(INLINE_AUDIO_LIMIT + 1);
    const src = createAudioSource(big, 'audio/mpeg');
    const first = src.partFor(ai, 'A');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toEqual({ fileData: { fileUri: 'uri://A', mimeType: 'audio/mpeg' } });
    expect(ai.files.upload).toHaveBeenCalledWith({ file: big, config: { mimeType: 'audio/mpeg' } });
    expect(ai.files.get).toHaveBeenCalledTimes(1);
    await src.partFor(ai, 'A');
    expect(ai.files.upload).toHaveBeenCalledTimes(1);
    await src.cleanup();
    await src.cleanup();
    expect(ai.files.delete).toHaveBeenCalledTimes(1);
    expect(ai.files.delete).toHaveBeenCalledWith({ name: 'files/A' });
  });

  it('fails clearly when Gemini cannot process the upload', async () => {
    const src = createAudioSource(blobOf(INLINE_AUDIO_LIMIT + 1), 'audio/mpeg');
    await expect(src.partFor(fakeAi('A', ['FAILED']), 'A')).rejects.toThrow('could not process');
  });
});

describe('generateWithRecovery with large audio', () => {
  it('uploads again with the fallback key, because uploads belong to one key', async () => {
    const ais: Record<string, any> = { 'KEY-A': fakeAi('KEY-A', ['ACTIVE']), 'KEY-B': fakeAi('KEY-B', ['ACTIVE']) };
    const src = createAudioSource(blobOf(INLINE_AUDIO_LIMIT + 1), 'audio/mpeg');
    const sent: any[] = [];
    const wrap = (ai: any, key: string) => {
      const real = ais[key];
      ai.models = { generateContent: async (req: any) => { sent.push([key, req.contents[0].parts[0]]); if (key === 'KEY-A') throw new Error('429 quota: GenerateRequestsPerDayPerProjectPerModel'); return { ok: 1 }; } };
      ai.files = real.files;
      return ai;
    };
    const out = await generateWithRecovery({
      provider: { key: 'KEY-A', source: 'Primary' },
      buildRequest: async (ai, key) => buildTranscriptionRequest('gemini-2.5-flash', 'pro', await src.partFor(wrap(ai, key), key)),
      lang: 'bn', setStage: vi.fn(), addToast: vi.fn(),
    });
    expect(out).toMatchObject({ apiKey: 'KEY-B', source: 'Backup', response: { ok: 1 } });
    expect(sent).toEqual([
      ['KEY-A', { fileData: { fileUri: 'uri://KEY-A', mimeType: 'audio/mpeg' } }],
      ['KEY-B', { fileData: { fileUri: 'uri://KEY-B', mimeType: 'audio/mpeg' } }],
    ]);
    await src.cleanup();
    expect(ais['KEY-A'].files.delete).toHaveBeenCalled();
    expect(ais['KEY-B'].files.delete).toHaveBeenCalled();
  });
});
