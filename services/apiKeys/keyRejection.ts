// Keys Gemini refuses whatever is asked: 401 "API key not valid" or 403 "free tier is not available for this
// project" / PERMISSION_DENIED. Each is kept for one quota day, so it is tried last instead of first on every file,
// and Settings says why; a key fixed meanwhile (billing turned on) is tried normally again the next day.
import { messageOf } from '../../utils/errorMessage';
import { nextQuotaReset } from './keyQuota';

const REJECTED_STORAGE = 'key_rejected';

export type KeyRejection = 'invalid' | 'noAccess';

interface RejectedKey {
  tail: string;
  reason: KeyRejection;
  until: number;
}

const rejectionOf = (err: unknown): KeyRejection | null => {
  const status = (err as { status?: number } | null | undefined)?.status;
  const message = messageOf(err) ?? '';
  if (status === 401 || /API_KEY_INVALID|API key not valid|UNAUTHENTICATED/.test(message)) return 'invalid';
  if (status === 403 || /PERMISSION_DENIED|free tier is not available/.test(message)) return 'noAccess';
  return null;
};

const readRejected = (): RejectedKey[] => {
  try {
    const list = JSON.parse(localStorage.getItem(REJECTED_STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// Called for every failed request
export const noteKeyRejection = (tail: string, err: unknown, now = Date.now()) => {
  const reason = rejectionOf(err);
  if (!reason) return;
  const others = readRejected().filter(k => k.until > now && k.tail !== tail);
  try {
    localStorage.setItem(REJECTED_STORAGE, JSON.stringify([...others, { tail, reason, until: nextQuotaReset(now) }]));
  } catch {
    // Storage full or blocked: the key is simply tried in its usual place
  }
};

// A request that worked: the key is fine again (billing turned on, or a new key with the same last letters)
export const clearKeyRejection = (tail: string) => {
  const list = readRejected();
  if (!list.some(k => k.tail === tail)) return;
  try {
    localStorage.setItem(REJECTED_STORAGE, JSON.stringify(list.filter(k => k.tail !== tail)));
  } catch {
    // Storage blocked: the mark simply runs out at the end of the quota day
  }
};

// Why Gemini refused this key today, if it did
export const keyRejection = (tail: string, now = Date.now()): KeyRejection | null =>
  readRejected().find(k => k.tail === tail && k.until > now)?.reason ?? null;
