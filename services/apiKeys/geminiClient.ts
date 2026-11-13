import type { GeminiClient, GenerateContentParameters } from '../../types/gemini';
import { logApiCall } from './apiCallStats';
import {
  requestGenerateContent,
  requestUploadFile,
  requestGetFile,
  requestDeleteFile,
} from './geminiTransport';
import { messageOf } from '../../utils/errorMessage';
import { noteQuotaError } from './keyQuota';
import { noteKeyRejection } from './keyRejection';
import { isServerBusy } from '../../utils/serverBusy';

const statusOf = (err: unknown) => (err as { status?: number } | null | undefined)?.status;

const isRateLimited = (err: unknown) =>
  statusOf(err) === 429 || /\b429\b|RESOURCE_EXHAUSTED/.test(String(messageOf(err) ?? ''));

// 503 "This model is currently experiencing high demand": temporary, worth retrying
const isOverloaded = (err: unknown) => isServerBusy(statusOf(err), messageOf(err));

// A request cancelled at its time limit (it is reported as a busy model, with this mark)
const isTimedOut = (err: unknown) => (err as { timedOut?: boolean } | null | undefined)?.timedOut === true;

// Waits before asking a busy model again (growing, as Google recommends)
export const OVERLOAD_RETRY_DELAYS_MS = [2000, 6000];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// A request that hangs is cancelled. Audio can legitimately take minutes.
export const TEXT_TIMEOUT_MS = 90_000;
export const MEDIA_TIMEOUT_MS = 600_000;
const hasMedia = (contents: unknown) =>
  (Array.isArray(contents) ? contents : [contents]).some((c: { parts?: unknown } | null | undefined) =>
    Array.isArray(c?.parts) && c.parts.some((p: { inlineData?: unknown; fileData?: unknown } | null | undefined) => p?.inlineData || p?.fileData));

/**
 * Every Gemini client in the app is created here and routes requests through the server API.
 * Each generateContent request (retries and failures included) is logged with Gemini's own token
 * counts, the model and the key's last 4 characters, so the quota monitor shows real usage.
 * A request always goes to the model it names: the user's choice of model is never changed here.
 */
export const createGeminiClient = async (apiKey: string): Promise<GeminiClient> => {
  const keyTail = apiKey.slice(-4);

  const trackedGenerate = async (request: GenerateContentParameters) => {
    const started = Date.now();
    const { timeoutMs: wantedTimeout, ...config } = request.config ?? {};
    const params = { ...request, config };
    const timeoutMs = wantedTimeout ?? (hasMedia(params.contents) ? MEDIA_TIMEOUT_MS : TEXT_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const timedOut = () => Object.assign(new Error(`503 UNAVAILABLE: no answer from ${params.model} within ${timeoutMs / 1000}s`), { status: 503, timedOut: true });
    try {
      const response = await requestGenerateContent(apiKey, {
        ...params,
        config: { ...params.config, abortSignal: controller.signal },
      });
      // A cancelled request can come back as an empty answer instead of an error; it is a timeout, not "no text"
      if (controller.signal.aborted) throw timedOut();
      const usage = response?.usageMetadata;
      logApiCall({
        status: 'success', model: params.model, keyTail, latency: Date.now() - started,
        promptTokens: usage?.promptTokenCount ?? 0, tokens: usage?.totalTokenCount ?? 0,
      });
      return response;
    } catch (err) {
      logApiCall({ status: 'error', model: params.model, keyTail, latency: Date.now() - started, rateLimited: isRateLimited(err) });
      noteQuotaError(keyTail, params.model, err);
      noteKeyRejection(keyTail, err);
      if (controller.signal.aborted) throw timedOut();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    models: {
      generateContent: async (params: GenerateContentParameters) => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await trackedGenerate(params);
          } catch (err) {
            // A busy model is asked again after a wait. One that gave no answer in time is not: it would most likely
            // make the request wait just as long again (a batch waits minutes for a busy server and tries once more).
            if (!isOverloaded(err) || isTimedOut(err) || attempt >= OVERLOAD_RETRY_DELAYS_MS.length) throw err;
            await sleep(OVERLOAD_RETRY_DELAYS_MS[attempt]);
          }
        }
      },
    },
    files: {
      upload: (params) => requestUploadFile(apiKey, params),
      get: (params) => requestGetFile(apiKey, params),
      delete: (params) => requestDeleteFile(apiKey, params),
    },
  };
};
