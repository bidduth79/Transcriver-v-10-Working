import { GoogleGenAI } from '@google/genai';
import { logApiCall } from './apiCallStats';

const isRateLimited = (err: any) =>
  err?.status === 429 || /\b429\b|RESOURCE_EXHAUSTED/.test(String(err?.message ?? ''));

/**
 * Every Gemini client in the app is created here. Each generateContent request (retries and failures
 * included) is logged with Gemini's own token counts, the model and the key's last 4 characters,
 * so the quota monitor shows real usage.
 */
export const createGeminiClient = (apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const generate = ai.models.generateContent.bind(ai.models);
  const keyTail = apiKey.slice(-4);

  ai.models.generateContent = async (params) => {
    const started = Date.now();
    try {
      const response = await generate(params);
      const usage = response?.usageMetadata;
      logApiCall({
        status: 'success', model: params.model, keyTail, latency: Date.now() - started,
        promptTokens: usage?.promptTokenCount ?? 0, tokens: usage?.totalTokenCount ?? 0,
      });
      return response;
    } catch (err) {
      logApiCall({ status: 'error', model: params.model, keyTail, latency: Date.now() - started, rateLimited: isRateLimited(err) });
      throw err;
    }
  };
  return ai;
};
