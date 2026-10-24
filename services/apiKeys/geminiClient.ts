import type { GoogleGenAI } from '@google/genai';
import { logApiCall } from './apiCallStats';
import { messageOf } from '../../utils/errorMessage';

const statusOf = (err: unknown) => (err as { status?: number } | null | undefined)?.status;

const isRateLimited = (err: unknown) =>
  statusOf(err) === 429 || /\b429\b|RESOURCE_EXHAUSTED/.test(String(messageOf(err) ?? ''));

// 503 "This model is currently experiencing high demand": temporary, worth retrying
const isOverloaded = (err: unknown) =>
  statusOf(err) === 503 || /\b503\b|UNAVAILABLE|high demand|overloaded/i.test(String(messageOf(err) ?? ''));

// Waits before retrying a busy model (growing, as Google recommends), then one similar model is tried
export const OVERLOAD_RETRY_DELAYS_MS = [2000, 6000];
export const OVERLOAD_FALLBACK_MODEL: Record<string, string> = {
  'gemini-3.8-flash': 'gemini-3.5-flash',
  'gemini-3.5-flash': 'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview': 'gemini-3.8-flash',
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// A request that hangs is cancelled and treated like a busy model. Audio can legitimately take minutes.
export const TEXT_TIMEOUT_MS = 90_000;
export const MEDIA_TIMEOUT_MS = 600_000;
const hasMedia = (contents: unknown) =>
  (Array.isArray(contents) ? contents : [contents]).some((c: { parts?: unknown } | null | undefined) =>
    Array.isArray(c?.parts) && c.parts.some((p: { inlineData?: unknown; fileData?: unknown } | null | undefined) => p?.inlineData || p?.fileData));

/**
 * Every Gemini client in the app is created here. Each generateContent request (retries and failures
 * included) is logged with Gemini's own token counts, the model and the key's last 4 characters,
 * so the quota monitor shows real usage. A model that is temporarily busy (503, or no answer within the
 * time limit) is retried after short waits and then replaced by a similar model on the same key.
 */
export const createGeminiClient = async (apiKey: string): Promise<GoogleGenAI> => {
  // The SDK (about 270 KB) is downloaded with the first AI request, not when the app opens
  const { GoogleGenAI: Client } = await import('@google/genai');
  const ai = new Client({ apiKey });
  const generate = ai.models.generateContent.bind(ai.models);
  const keyTail = apiKey.slice(-4);

  const trackedGenerate: typeof generate = async (params) => {
    const started = Date.now();
    const timeoutMs = hasMedia(params.contents) ? MEDIA_TIMEOUT_MS : TEXT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await generate({ ...params, config: { ...params.config, abortSignal: controller.signal } });
      const usage = response?.usageMetadata;
      logApiCall({
        status: 'success', model: params.model, keyTail, latency: Date.now() - started,
        promptTokens: usage?.promptTokenCount ?? 0, tokens: usage?.totalTokenCount ?? 0,
      });
      return response;
    } catch (err) {
      logApiCall({ status: 'error', model: params.model, keyTail, latency: Date.now() - started, rateLimited: isRateLimited(err) });
      if (controller.signal.aborted) {
        throw Object.assign(new Error(`503 UNAVAILABLE: no answer from ${params.model} within ${timeoutMs / 1000}s`), { status: 503 });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  ai.models.generateContent = async (params) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await trackedGenerate(params);
      } catch (err) {
        if (!isOverloaded(err)) throw err;
        if (attempt < OVERLOAD_RETRY_DELAYS_MS.length) {
          await sleep(OVERLOAD_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        const fallback = OVERLOAD_FALLBACK_MODEL[params.model];
        if (!fallback) throw err;
        console.info(`[Gemini] ${params.model} is busy; using ${fallback} for this request`);
        return await trackedGenerate({ ...params, model: fallback });
      }
    }
  };
  return ai;
};
