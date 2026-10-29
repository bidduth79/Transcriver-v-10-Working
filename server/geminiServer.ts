// Gemini helpers for the server: which key to use, the client, error status codes and request cancelling
import type express from 'express';
import { GoogleGenAI } from '@google/genai';
import { getEnvKeys, keyFromToken } from './envKeys.ts';

// The first .env key, for requests that name no key ('SERVER_KEY') and for live transcription
export const getServerEnvKey = (): string => getEnvKeys()[0]?.key ?? '';

// A key saved in the browser is used as sent; a .env token is turned into its key here
const resolveApiKey = (providedKey?: unknown): string => {
  const candidate = typeof providedKey === 'string' ? providedKey.trim() : '';
  if (!candidate || candidate === 'SERVER_KEY') return getServerEnvKey();
  const fromEnv = keyFromToken(candidate);
  if (fromEnv !== undefined) return fromEnv;
  if (candidate.startsWith('env:')) {
    throw Object.assign(new Error('This .env key is no longer in .env. Reload the key list in Settings.'), { status: 400 });
  }
  return candidate;
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

// Runs one Gemini call with the requested key only. Moving on to the next key when one fails is the browser's
// job, so it knows which key was used and can show each key's quota.
export const runWithKey = async <T>(requestedKey: unknown, op: (ai: GoogleGenAI) => Promise<T>): Promise<T> => {
  const apiKey = resolveApiKey(requestedKey);
  if (!apiKey) {
    throw Object.assign(new Error('No API Key configured on server.'), { status: 400 });
  }
  return op(createServerGeminiClient(apiKey));
};
