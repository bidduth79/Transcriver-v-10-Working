// Gemini helpers for the server: which key to use, the client, error status codes and request cancelling
import type express from 'express';
import { GoogleGenAI } from '@google/genai';

export const getServerEnvKey = (): string =>
  (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY_1 ||
    ''
  ).trim();

const resolveApiKey = (providedKey?: unknown): string => {
  const candidate = typeof providedKey === 'string' ? providedKey.trim() : '';
  if (candidate && candidate !== 'SERVER_KEY') return candidate;
  return getServerEnvKey();
};

export const createServerGeminiClient = (apiKey: string) =>
  new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

export const statusFromError = (err: unknown): number => {
  const status = (err as { status?: number } | null | undefined)?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) return status;
  const msg = String((err as { message?: string } | null | undefined)?.message ?? err ?? '');
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (/\b503\b|UNAVAILABLE|high demand|overloaded/i.test(msg)) return 503;
  if (/\b403\b|PERMISSION_DENIED|denied access|suspended/i.test(msg)) return 403;
  if (/\b400\b|INVALID_ARGUMENT|API_KEY_INVALID|api key not valid/i.test(msg)) return 400;
  return 500;
};

// Aborts when the browser stops waiting (its time limit, or the tab closes), so Gemini stops working on it
export const abortWhenClientLeaves = (res: express.Response) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
};

export const runWithServerFallback = async <T>(
  requestedKey: unknown,
  op: (ai: GoogleGenAI) => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  const primaryKey = resolveApiKey(requestedKey);
  if (!primaryKey) {
    throw Object.assign(new Error('No API Key configured on server.'), { status: 400 });
  }
  try {
    return await op(createServerGeminiClient(primaryKey));
  } catch (err) {
    const serverKey = getServerEnvKey();
    // Nobody is waiting any more: a second try would only spend quota
    if (signal?.aborted) throw err;
    if (serverKey && serverKey !== primaryKey) {
      return await op(createServerGeminiClient(serverKey));
    }
    throw err;
  }
};
