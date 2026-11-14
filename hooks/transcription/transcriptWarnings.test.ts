import { describe, it, expect } from 'vitest';
import { transcriptWarnings } from './transcriptWarnings';

// Bengali text that never repeats itself, about `letters` letters long (a fixed seed, so every run is the same)
let seed = 7;
const talk = (letters: number) => {
  const words: string[] = [];
  let count = 0;
  while (count < letters) {
    let word = '';
    for (let i = 0; i < 5; i++) {
      // 32-bit integer steps (plain multiplication would lose precision and start repeating)
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      word += String.fromCharCode(0x0995 + ((seed >>> 16) % 37));
    }
    words.push(word);
    count += word.length;
  }
  return `${words.join(' ')}।`;
};
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
// One timed line a minute, `lettersPerLine` letters each, from `from` to `to` seconds
const timed = (from: number, to: number, lettersPerLine = 650) => {
  const lines: string[] = [];
  for (let at = from; at < to; at += 60) lines.push(`[${clock(at)}] **Speaker 1:** ${talk(lettersPerLine)}`);
  return lines.join('\n');
};
const check = (text: string, seconds: number, answer = text) => transcriptWarnings(text, answer, seconds);

describe('transcriptWarnings', () => {
  it('finds nothing in a normal transcript that runs to the end of the audio', () => {
    expect(check(timed(0, 1200), 1200)).toEqual([]);
  });

  it('warns when the text is far too little for the length of the audio', () => {
    expect(check(timed(0, 1200, 150), 1200)).toEqual(['littleText']);
  });

  it('warns when the words end more than 5 minutes before the audio does, not at 3 minutes', () => {
    expect(check(timed(0, 600), 1200)).toEqual(['endsEarly']);
    expect(check(timed(0, 1020), 1200)).toEqual([]);
  });

  it('warns when the times go past the end of the audio', () => {
    expect(check(timed(0, 1500), 1200)).toEqual(['pastEnd']);
  });

  it('warns about minutes in the middle with almost no text, but not about a long speech in one line', () => {
    const gap = `${timed(0, 300)}\n[05:00] **Speaker 1:** ${talk(200)}\n${timed(780, 1200)}`;
    expect(check(gap, 1200)).toEqual(['gap']);
    const longSpeech = `${timed(0, 300)}\n[05:00] **Speaker 1:** ${talk(480 * 10)}\n${timed(780, 1200)}`;
    expect(check(longSpeech, 1200)).toEqual([]);
  });

  it("warns when Gemini's answer went round in a loop, even though the saved text has the repeats taken out", () => {
    const clean = timed(0, 1200);
    const paragraph = talk(600);
    const looping = `${clean}\n${Array.from({ length: 12 }, (_, i) => `[${clock(600 + i * 30)}] **Speaker 1:** ${paragraph}`).join('\n')}`;
    expect(check(clean, 1200, looping)).toEqual(['loop']);
  });

  it("warns when the transcript has under 80% of the recording's YouTube captions, also on short audio", () => {
    const text = timed(0, 600);
    const letters = (text.match(/[ঀ-৿]/g) || []).length;
    expect(check(text, 600)).toEqual([]);
    expect(transcriptWarnings(text, text, 600, Math.round(letters / 0.75))).toEqual(['lessThanCaptions']);
    expect(transcriptWarnings(text, text, 600, Math.round(letters / 0.85))).toEqual([]);
    expect(transcriptWarnings(timed(0, 120, 50), timed(0, 120, 50), 120, 5000)).toEqual(['lessThanCaptions']);
    // Captions of only a few words say too little
    expect(transcriptWarnings(timed(0, 120, 50), timed(0, 120, 50), 120, 400)).toEqual([]);
  });

  it('judges only the loop on short audio, an unknown length, or a transcript without times', () => {
    expect(check(timed(0, 120, 50), 240)).toEqual([]);
    expect(check(timed(0, 120, 50), NaN)).toEqual([]);
    expect(check(talk(5000), 1200)).toEqual([]);
    expect(check(talk(500), 1200)).toEqual(['littleText']);
  });
});
