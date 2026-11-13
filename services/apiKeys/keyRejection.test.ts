import { describe, it, expect, beforeEach } from 'vitest';
import { noteKeyRejection, keyRejection } from './keyRejection';

// 29 Oct 2026, 10:00 in Dhaka; the quota day ends at 07:00 UTC the same day
const NOW = Date.UTC(2026, 9, 29, 4, 0, 0);
const NEXT_DAY = Date.UTC(2026, 9, 29, 7, 0, 0);
const error = (status: number, message: string) => Object.assign(new Error(message), { status });

beforeEach(() => localStorage.clear());

describe('keyRejection', () => {
  it('remembers an invalid key and one without access until the quota day ends', () => {
    noteKeyRejection('AHeQ', error(401, '{"error":{"code":401,"message":"API key not valid. Please pass a valid API key.","status":"UNAUTHENTICATED"}}'), NOW);
    noteKeyRejection('0yPg', error(403, '{"error":{"code":403,"message":"The Gemini API free tier is not available for this project.","status":"PERMISSION_DENIED"}}'), NOW);
    expect(keyRejection('AHeQ', NOW)).toBe('invalid');
    expect(keyRejection('0yPg', NOW)).toBe('noAccess');
    expect(keyRejection('0yPg', NEXT_DAY)).toBeNull();
  });

  it('keeps nothing for errors that pass: a rate limit, a busy server, a bad request', () => {
    for (const e of [error(429, 'RESOURCE_EXHAUSTED'), error(503, 'UNAVAILABLE'), error(400, 'bad request')]) noteKeyRejection('AAAA', e, NOW);
    expect(keyRejection('AAAA', NOW)).toBeNull();
  });
});
