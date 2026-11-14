// "Test all keys": one tiny request ("Say OK") per key on the chosen model, the only way to see a key's real state
// (valid, project with access, today's quota). Each test spends one request of that key's daily quota, and goes
// through the app's Gemini client, so a refused key or a used-up quota is remembered as with any other request.
import { createGeminiClient } from './geminiClient';
import { parseRateLimit } from '../../hooks/transcription/rateLimit';
import { isServerBusy } from '../../utils/serverBusy';
import { messageOf } from '../../utils/errorMessage';

export type KeyCheckStatus = 'ok' | 'invalid' | 'noAccess' | 'quotaToday' | 'rateLimited' | 'busy' | 'error';

export interface KeyCheckResult {
  tail: string;
  status: KeyCheckStatus;
  model: string;
  at: number;
  message?: string;
}

const RESULTS_STORAGE = 'key_check_results';

const statusOf = (err: unknown): KeyCheckStatus => {
  const status = (err as { status?: number } | null | undefined)?.status;
  const message = messageOf(err) ?? '';
  if (status === 401 || /API_KEY_INVALID|API key not valid|UNAUTHENTICATED/.test(message)) return 'invalid';
  if (status === 403 || /PERMISSION_DENIED|free tier is not available/.test(message)) return 'noAccess';
  const limit = parseRateLimit(err);
  if (limit.isRateLimit) return limit.isDaily ? 'quotaToday' : 'rateLimited';
  return isServerBusy(status, message) ? 'busy' : 'error';
};

const readResults = (): Record<string, KeyCheckResult> => {
  try {
    const saved = JSON.parse(localStorage.getItem(RESULTS_STORAGE) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
};

// The last test of this key, if any
export const lastKeyCheck = (tail: string): KeyCheckResult | null => readResults()[tail] ?? null;

// Tests one key (a saved key or a .env token) and keeps the result for the key lists
export const checkKey = async (key: string, model: string, now = Date.now): Promise<KeyCheckResult> => {
  const tail = key.trim().slice(-4);
  let result: KeyCheckResult;
  try {
    const ai = await createGeminiClient(key.trim());
    await ai.models.generateContent({ model, contents: 'Say OK', config: { maxOutputTokens: 16 } });
    result = { tail, status: 'ok', model, at: now() };
  } catch (err) {
    result = { tail, status: statusOf(err), model, at: now(), message: (messageOf(err) ?? '').slice(0, 160) };
  }
  try {
    localStorage.setItem(RESULTS_STORAGE, JSON.stringify({ ...readResults(), [tail]: result }));
  } catch {
    // Storage blocked: the result still shows in the summary message
  }
  return result;
};
