import { describe, it, expect } from 'vitest';
import { isServerBusy } from './serverBusy';

const noFreeTier = '{"error":{"code":403,"message":"The Gemini API free tier is not available for this project. See https://ai.google.dev/gemini-api/docs/troubleshooting#project-unavailable","status":"PERMISSION_DENIED"}}';

describe('isServerBusy', () => {
  it('is a 503, or a message without status saying 503, UNAVAILABLE or high demand', () => {
    expect(isServerBusy(503, '')).toBe(true);
    expect(isServerBusy(undefined, '{"error":{"code":503,"status":"UNAVAILABLE"}}')).toBe(true);
    expect(isServerBusy(undefined, 'This model is currently experiencing high demand.')).toBe(true);
    expect(isServerBusy(undefined, '503 UNAVAILABLE: no answer within 600s')).toBe(true);
  });

  it('is never a key or request that will fail again: another status, or "unavailable" only in a link', () => {
    expect(isServerBusy(403, noFreeTier)).toBe(false);
    expect(isServerBusy(undefined, noFreeTier)).toBe(false);
    expect(isServerBusy(401, 'API key not valid. UNAVAILABLE')).toBe(false);
    expect(isServerBusy(undefined, undefined)).toBe(false);
  });
});
