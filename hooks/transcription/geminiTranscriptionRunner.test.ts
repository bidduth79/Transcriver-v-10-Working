import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GenerateContentParameters } from '../../types/gemini';

const m = vi.hoisted(() => ({ answers: [] as (Error | { text: string })[], sent: [] as GenerateContentParameters[] }));

vi.mock('../../services/apiKeys/geminiClient', () => ({
  createGeminiClient: async () => ({
    models: {
      generateContent: async (request: GenerateContentParameters) => {
        m.sent.push(request);
        const answer = m.answers.shift();
        if (answer instanceof Error) throw answer;
        return answer;
      },
    },
  }),
}));
vi.mock('../../services/ApiKeyManager', () => ({
  getFallbackProviders: async () => [],
  setActiveApiKey: vi.fn(),
  getModelDefinition: () => ({ category: 'balanced' }),
  isSpeedOptimizationEnabled: () => true,
}));

import { generateWithRecovery } from './geminiTranscriptionRunner';

const options = () => ({
  provider: { key: 'KEY', source: 'Main' },
  buildRequest: async () => ({ model: 'gemini-3.8-flash', contents: [], config: { thinkingConfig: { thinkingLevel: 'LOW' as const } } }),
  lang: 'en' as const,
  setStage: vi.fn(),
  addToast: vi.fn(),
});

beforeEach(() => { m.answers = []; m.sent = []; });

describe('generateWithRecovery', () => {
  it('asks again without thinkingConfig when the model does not take it', async () => {
    m.answers = [new Error('400 INVALID_ARGUMENT: thinking_level is not supported for this model'), { text: 'ok' }];
    const result = await generateWithRecovery(options());
    expect(result.response).toEqual({ text: 'ok' });
    expect(m.sent[1].config).not.toHaveProperty('thinkingConfig');
  });

  it('does not send a busy or slow request again in another form', async () => {
    const slow = Object.assign(new Error('503 UNAVAILABLE: no answer from gemini-3.8-flash within 600s'), { status: 503, timedOut: true });
    m.answers = [slow, { text: 'never asked' }];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(generateWithRecovery(options())).rejects.toThrow('no answer');
    expect(m.sent).toHaveLength(1);
  });
});
