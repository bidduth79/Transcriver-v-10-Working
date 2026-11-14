import { describe, it, expect, vi, afterEach } from 'vitest';
import { listGoogleModels } from './modelCatalog';

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: object) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }));

describe('listGoogleModels', () => {
  it('asks the server with the key and keeps only Gemini models that can transcribe', async () => {
    const fetch = reply(200, { models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', inputTokenLimit: 1048576, actions: ['generateContent', 'countTokens'] },
      { id: 'gemini-3.5-transcribe', label: 'Gemini 3.5 Transcribe', actions: ['generateContent'] },
      { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2', actions: ['generateContent'] },
      { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live', actions: ['bidiGenerateContent'] },
      { id: 'gemma-4-31b-it', label: 'Gemma 4', actions: ['generateContent'] },
      { id: 'deep-research-preview-04-2026', label: 'Deep Research', actions: ['generateContent'] },
      { id: 'gemini-2.5-computer-use-preview-10-2025', label: 'Computer Use', actions: ['generateContent'] },
    ] });
    vi.stubGlobal('fetch', fetch);
    expect(await listGoogleModels('env:env-1:gXeQ')).toEqual([
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', inputTokenLimit: 1048576 },
      { id: 'gemini-3.5-transcribe', label: 'Gemini 3.5 Transcribe', inputTokenLimit: undefined },
    ]);
    expect(fetch).toHaveBeenCalledWith('/api/gemini/models', expect.objectContaining({ method: 'POST', body: JSON.stringify({ apiKey: 'env:env-1:gXeQ' }) }));
  });

  it('passes on the server\'s error', async () => {
    vi.stubGlobal('fetch', reply(401, { error: { message: 'API key not valid' } }));
    await expect(listGoogleModels('bad')).rejects.toThrow('API key not valid');
  });
});
