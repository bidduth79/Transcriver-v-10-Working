import { describe, it, expect } from 'vitest';
import { isNotATranscript } from './answerCheck';

const bengali = (letters: number) => 'ক'.repeat(letters);

describe('isNotATranscript', () => {
  it('rejects an answer with almost no Bengali for long audio', () => {
    const description = 'An assistive audio-to-text transcription has been provided in continuous, readable Bengali paragraphs.';
    expect(isNotATranscript(description, 83 * 60)).toBe(true);
    expect(isNotATranscript(bengali(100), 83 * 60)).toBe(true);
  });

  it('accepts real transcripts, and leaves very short audio alone', () => {
    expect(isNotATranscript(bengali(83 * 20), 83 * 60)).toBe(false);
    expect(isNotATranscript('ok', 90)).toBe(false);
  });
});
