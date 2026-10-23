import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../../../services/ApiKeyManager', () => ({
  getActiveProvider: async () => ({ key: 'K', model: 'gemini-3.8-flash', source: 'S' }),
  incrementTotalCalls: vi.fn(),
  getModelDefinition: () => ({ category: 'balanced' }),
  isSpeedOptimizationEnabled: () => true,
}));
vi.mock('../../../services/SystemLogger', () => ({ logSystemActivity: vi.fn() }));
vi.mock('../../../services/apiKeys/geminiClient', () => ({ createGeminiClient: () => ({ models: { generateContent: m.generate } }) }));

import { useSummaryAnalysis } from './useSummaryLogic';

const longTranscript = 'intro '.repeat(3000) + 'সীমান্তে টহল বেড়েছে' + ' outro'.repeat(50);
const run = async (answer: string) => {
  m.generate.mockResolvedValueOnce({ text: answer });
  const addToast = vi.fn();
  const { result } = renderHook(() => useSummaryAnalysis('টহল', longTranscript, 'en', addToast));
  await act(async () => { await result.current.performAIAnalysis(); });
  return { result, addToast };
};

beforeEach(() => m.generate.mockReset());

describe('useSummaryAnalysis', () => {
  it('sends the passage around the term (not the first 10,000 characters) and asks for JSON', async () => {
    const { result } = await run('{"sentiment":"Negative","remark":"টহল নিয়ে উদ্বেগ"}');
    const req = m.generate.mock.calls[0][0];
    expect(longTranscript.indexOf('টহল')).toBeGreaterThan(10000);
    expect(req.contents).toContain('সীমান্তে টহল বেড়েছে');
    expect(req.config.responseMimeType).toBe('application/json');
    expect(req.config.responseSchema.required).toEqual(['sentiment', 'remark']);
    // Speed Boost on: a short analysis does not need deep thinking
    expect(req.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(result.current.aiAnalysis).toEqual({ sentiment: 'negative', remark: 'টহল নিয়ে উদ্বেগ' });
  });

  it('still reads an older plain-text answer', async () => {
    const { result } = await run('SENTIMENT: Positive\nREMARK: ভালো');
    expect(result.current.aiAnalysis).toEqual({ sentiment: 'positive', remark: 'ভালো' });
  });
});
