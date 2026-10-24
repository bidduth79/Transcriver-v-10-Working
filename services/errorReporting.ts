import { logSystemActivity } from './SystemLogger';
import { messageOf } from '../utils/errorMessage';

/**
 * Keeps unexpected app errors in the Activity Log (System / Error), on this device only. Nothing is sent
 * anywhere. Only the error message and the code location are kept, cut short, so transcript text that an
 * error message might quote cannot fill the log. The same error is recorded once a minute at most.
 */
const MAX_MESSAGE = 200;
const MAX_STACK_LINES = 4;
const REPEAT_WINDOW_MS = 60_000;
const lastSeen = new Map<string, number>();

const stackOf = (err: unknown) => {
  const stack = (err as { stack?: unknown } | null | undefined)?.stack;
  if (typeof stack !== 'string') return '';
  // Only the "at function (file:line:col)" lines, never the message part of the stack
  return stack.split('\n').filter(line => line.trim().startsWith('at ')).slice(0, MAX_STACK_LINES).map(line => line.trim()).join('\n');
};

export const reportAppError = (source: string, err: unknown) => {
  const raw = messageOf(err) ?? (typeof err === 'string' ? err : String(err));
  const message = raw.length > MAX_MESSAGE ? `${raw.slice(0, MAX_MESSAGE)}…` : raw;
  const key = `${source}:${message}`;
  const now = Date.now();
  if (now - (lastSeen.get(key) ?? 0) < REPEAT_WINDOW_MS) return;
  lastSeen.set(key, now);
  logSystemActivity('SYSTEM', 'ERROR', `App error (${source})`, [message, stackOf(err)].filter(Boolean).join('\n'));
};
