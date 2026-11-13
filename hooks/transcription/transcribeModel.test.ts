import { describe, it, expect } from 'vitest';
import { isTranscribeModel } from './transcribeModel';

describe('isTranscribeModel', () => {
  it('knows the speech-only transcribe models from the general ones', () => {
    expect(isTranscribeModel('gemini-3.5-transcribe')).toBe(true);
    expect(isTranscribeModel('gemini-3.8-flash')).toBe(false);
    expect(isTranscribeModel('gemini-3.5-flash-lite')).toBe(false);
  });
});
