import { describe, it, expect } from 'vitest';
import { emptyTranscriptError, failureKindOf } from './transcriptionErrors';

describe('failureKindOf', () => {
  it('knows a busy server, also when a request got no answer in time', () => {
    expect(failureKindOf(Object.assign(new Error('503 UNAVAILABLE: no answer from gemini-3.8-flash within 600s'), { status: 503 }))).toBe('busy');
    expect(failureKindOf(new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand."}}'))).toBe('busy');
  });

  it('knows an audio refused for its content from an empty answer', () => {
    expect(failureKindOf(emptyTranscriptError('PROHIBITED_CONTENT', 'en'))).toBe('refused');
    expect(failureKindOf(emptyTranscriptError('SAFETY', 'en'))).toBe('refused');
    expect(failureKindOf(emptyTranscriptError('NO_ANSWER', 'en'))).toBe('other');
  });

  it('takes anything else as an ordinary failure', () => {
    expect(failureKindOf(new Error('429 quota'))).toBe('other');
    expect(failureKindOf(undefined)).toBe('other');
  });
});

describe('emptyTranscriptError', () => {
  it('does not blame a busy server for a refused audio', () => {
    const message = emptyTranscriptError('PROHIBITED_CONTENT', 'en').message;
    expect(message).toContain('content policy (PROHIBITED_CONTENT)');
    expect(message).not.toMatch(/busy; please try again/);
    expect(emptyTranscriptError('NO_ANSWER', 'en', { part: 2, parts: 3 }).message).toBe('Gemini returned no text (part 2 of 3). Reason: NO_ANSWER. The server may be busy; please try again shortly.');
  });
});
