import { describe, it, expect } from 'vitest';
import { modelForAudioLength, LONG_AUDIO_MODEL } from './transcribeModel';

describe('modelForAudioLength', () => {
  it('sends audio too long for the transcribe model to the general model', () => {
    // An 83-minute recording is about 160,000 tokens; the transcribe model takes 98,304
    expect(modelForAudioLength('gemini-3.5-transcribe', 83 * 60)).toBe(LONG_AUDIO_MODEL);
    expect(modelForAudioLength('gemini-3.5-transcribe', 30 * 60)).toBe('gemini-3.5-transcribe');
  });

  it('leaves other models and unknown lengths alone', () => {
    expect(modelForAudioLength('gemini-3.5-flash', 83 * 60)).toBe('gemini-3.5-flash');
    expect(modelForAudioLength('gemini-3.5-transcribe', 0)).toBe('gemini-3.5-transcribe');
  });
});
