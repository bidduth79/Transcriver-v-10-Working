import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  generate: vi.fn(),
  keys: [] as string[],
  getActiveProvider: vi.fn(),
  getFallbackProviders: vi.fn(),
  setActiveApiKey: vi.fn(),
  incrementTotalCalls: vi.fn(),
  speedOpt: { value: false },
  addToStore: vi.fn(),
  setHistory: vi.fn(),
}));

vi.mock('@google/genai', async (orig) => ({
  ...(await orig<typeof import('@google/genai')>()),
  GoogleGenAI: class {
    models: any;
    files = { delete: vi.fn() };
    constructor({ apiKey }: { apiKey: string }) {
      m.keys.push(apiKey);
      this.models = { generateContent: (opts: any) => m.generate(apiKey, structuredClone(opts)) };
    }
  },
}));
vi.mock('../services/ApiKeyManager', () => ({
  getActiveProvider: m.getActiveProvider,
  getFallbackProviders: m.getFallbackProviders,
  setActiveApiKey: m.setActiveApiKey,
  incrementTotalCalls: m.incrementTotalCalls,
  getModelDefinition: () => ({ category: 'fast' }),
  isSpeedOptimizationEnabled: () => m.speedOpt.value,
}));
vi.mock('../services/db', () => ({ addToStore: m.addToStore, STORES: { HISTORY: 'history' } }));
vi.mock('../services/firebaseThrottledQueue', () => ({ setHeavyProcessingActive: vi.fn() }));
vi.mock('../services/SystemLogger', () => ({ logSystemActivity: vi.fn() }));
vi.mock('./useHistoryStore', () => ({
  useHistoryStore: { getState: () => ({ history: [], setHistory: m.setHistory }) },
}));
vi.mock('./useBroadcastSync', () => ({ broadcastHistoryUpdate: vi.fn() }));
vi.mock('./transcription/transcriptionUtils', async (orig) => ({
  ...(await orig<typeof import('./transcription/transcriptionUtils')>()),
  detectAudioMimeType: async () => ({ mimeType: 'audio/mpeg', isOggOpus: false, isWhatsApp: false }),
  convertAudioToWav: async () => null,
  blobToBase64: async () => 'BASE64',
}));

import { useTranscription } from './useTranscription';

const resp = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: text ? [{ text }] : [] }, finishReason }],
});
const audio = () => new File(['abc'], 'clip.mp3', { type: 'audio/mpeg' });
const meta = { name: 'clip.mp3', duration: '00:10', size: '0.01 MB' };

const setup = (mode: 'normal' | 'pro' = 'pro') => {
  const [addToast, playSuccessSound, updateApiStats] = [vi.fn(), vi.fn(), vi.fn()];
  const { result } = renderHook(() =>
    useTranscription('bn', addToast, vi.fn(), updateApiStats, playSuccessSound, mode));
  const run = async (file: Blob = audio()) => {
    let out: any;
    await act(async () => { out = await result.current.processTranscription(file, meta); });
    return out;
  };
  return { result, run, addToast, playSuccessSound, updateApiStats };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.keys.length = 0;
  m.speedOpt.value = false;
  localStorage.clear();
  m.getActiveProvider.mockResolvedValue({ key: 'KEY-AAAA', source: 'Primary', model: 'gemini-3.8-flash' });
  m.getFallbackProviders.mockResolvedValue([]);
});

describe('useTranscription.processTranscription', () => {
  it('transcribes successfully and saves history', async () => {
    m.generate.mockResolvedValue(resp('[00:00] **Speaker 1:** হ্যালো'));
    const { result, run, addToast, playSuccessSound, updateApiStats } = setup();
    const out = await run();

    expect(out).toEqual({ success: true, text: '[00:00] **Speaker 1:** হ্যালো' });    expect(result.current.status).toBe('completed');
    expect(result.current.transcript).toBe(out.text);
    expect(result.current.progress).toBe(100);

    const [key, req] = m.generate.mock.calls[0];
    expect(key).toBe('KEY-AAAA');
    expect(req.model).toBe('gemini-3.8-flash');
    expect(req.config).not.toHaveProperty('temperature');
    expect(req.config.safetySettings).toHaveLength(4);
    expect(req.config.thinkingConfig).toBeUndefined();
    expect(req.contents[0].parts[0].inlineData).toEqual({ mimeType: 'audio/mpeg', data: 'BASE64' });

    expect(m.addToStore).toHaveBeenCalledWith('history', expect.objectContaining({
      fileName: 'clip.mp3', transcript: out.text, extension: 'mp3', duration: '00:10',
    }));
    expect(m.setHistory).toHaveBeenCalledTimes(1);
    expect(m.incrementTotalCalls).toHaveBeenCalledWith('Transcription', 'gemini-3.8-flash', 'Primary');
    expect(updateApiStats).toHaveBeenCalled();
    await waitFor(() => expect(playSuccessSound).toHaveBeenCalled());
    expect(addToast).toHaveBeenCalledWith('ট্রান্সক্রিপশন সফলভাবে সম্পন্ন হয়েছে!', 'success');
  });

  it('uses the normal-mode prompt without extra per-model rules', async () => {
    m.getActiveProvider.mockResolvedValue({ key: 'K', source: 'S', model: 'gemini-3.5-flash-lite' });
    m.generate.mockResolvedValue(resp('text'));
    const { run } = setup('normal');
    await run();
    const req = m.generate.mock.calls[0][1];
    expect(req.contents[0].parts[1].text).toMatch(/^Please transcribe the entire audio/);
    expect(req.contents[0].parts[1].text).not.toContain('CRITICAL FOR THIS MODEL');
  });

  it('rejects files over 500MB without calling the API', async () => {
    const big = new Blob(['x']);
    Object.defineProperty(big, 'size', { value: 600 * 1024 * 1024 });
    const { result, run, addToast } = setup();
    await run(big);
    expect(m.generate).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('৫০০ এমবি'), 'error');
    expect(result.current.status).toBe('idle');
  });

  it('reports a friendly error when no API key exists', async () => {
    m.getActiveProvider.mockResolvedValue(null);
    const { result, run } = setup();
    const out = await run();
    expect(out.success).toBe(false);
    expect(out.error).toContain('কোনো এপিআই কি');
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(out.error);
  });

  it('switches to a fallback key when the primary key is blocked', async () => {
    m.getFallbackProviders.mockResolvedValue([{ id: 'k2', key: 'KEY-BBBB', source: 'Backup' }]);
    m.generate.mockImplementation(async (key: string) => {
      if (key === 'KEY-AAAA') throw new Error('429 quota exceeded: GenerateRequestsPerDayPerProjectPerModel');
      return resp('ok');
    });
    const { run, addToast } = setup();
    const out = await run();
    expect(out).toEqual({ success: true, text: 'ok' });
    expect(m.setActiveApiKey).toHaveBeenCalledWith('k2');
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Backup'), 'info');
    expect(m.incrementTotalCalls).toHaveBeenCalledWith('Transcription', 'gemini-3.8-flash', 'Backup');
  });

  it('shows quota message with key label when all keys fail', async () => {
    m.generate.mockRejectedValue(new Error('429 quota exceeded: GenerateRequestsPerDayPerProjectPerModel'));
    const { run } = setup();
    const out = await run();
    expect(out.error).toContain('কোটা শেষ');
    expect(out.error).toContain('Primary (****AAAA)');
  });

  it('retries with high-sensitivity prompt when the first answer is empty', async () => {
    m.generate.mockResolvedValueOnce(resp('')).mockResolvedValueOnce(resp('retry text'));
    const { run } = setup();
    const out = await run();
    expect(out.text).toBe('retry text');
    expect(m.generate).toHaveBeenCalledTimes(2);
    expect(m.generate.mock.calls[1][1].config.systemInstruction).toContain('high-sensitivity');
  });

  it('returns a no-speech marker and skips saving when nothing is heard', async () => {
    m.generate.mockResolvedValue(resp(''));
    const { run } = setup();
    const out = await run();
    expect(out.text).toContain('No audible speech detected');
    expect(m.addToStore).not.toHaveBeenCalled();
    expect(m.setHistory).not.toHaveBeenCalled();
  });

  it('fails with safety message on SAFETY finish reason', async () => {
    m.generate.mockResolvedValue(resp('', 'SAFETY'));
    const { run } = setup();
    const out = await run();
    expect(m.generate).toHaveBeenCalledTimes(1);
    expect(out.error).toContain('নিরাপত্তা নীতিমালার');
  });

  it('adds thinkingConfig with Speed Boost and retries without it on error', async () => {
    m.speedOpt.value = true;
    m.generate.mockRejectedValueOnce(new Error('thinking not supported')).mockResolvedValueOnce(resp('plain'));
    const { run } = setup();
    const out = await run();
    expect(m.generate.mock.calls[0][1].config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(m.generate.mock.calls[1][1].config.thinkingConfig).toBeUndefined();
    expect(out.text).toBe('plain');
  });

  it('maps 503 errors to the high-demand message (after the busy-model retries)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] }); m.generate.mockRejectedValue(new Error('503 UNAVAILABLE'));
    const pending = setup().run();
    await vi.advanceTimersByTimeAsync(9000);
    expect((await pending).error).toContain('High Demand'); vi.useRealTimers();
  });
});
