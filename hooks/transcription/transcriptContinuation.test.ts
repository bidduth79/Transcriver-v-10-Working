import { describe, it, expect } from 'vitest';
import { lastTimestampSeconds, wordsEndSeconds, joinRest } from './transcriptContinuation';
import { comparableText } from './textRepetition';
import { NO_MORE_SPEECH } from '../../constants/instructions';

// Made-up words from a fixed seed: talk from different seeds shares almost no letter sequences
const talk = (seed: number, words: number) => {
  let state = seed;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return Array.from({ length: words }, () =>
    Array.from({ length: 4 + (next() % 5) }, () => 'abcdefghijklmnopqrstuvwxyz'[next() % 26]).join('')).join(' ');
};
// The same talk with every tenth word heard differently, as when the model transcribes it again
const heardAgain = (text: string) => text.split(' ').map((word, i) => (i % 10 === 9 ? talk(1000 + i, 1) : word)).join(' ');

describe('lastTimestampSeconds', () => {
  it('finds the latest time, in any timestamp form', () => {
    expect(lastTimestampSeconds('[00:10] a\n[26:35] b')).toBe(1595);
    expect(lastTimestampSeconds('[1:02:03] a\n[০৫:০০] b')).toBe(3723);
    expect(lastTimestampSeconds('no time')).toBeNull();
  });
});

describe('wordsEndSeconds', () => {
  it('lets a long last paragraph reach as far as its words take to say, at the speed of the timed part', () => {
    const first = talk(1, 200);
    const last = talk(2, 400);
    const rate = comparableText(first).length / 120;
    expect(wordsEndSeconds(`[00:00] **S1:** ${first}\n[02:00] **S1:** ${last}`)).toBeCloseTo(120 + comparableText(last).length / rate, 5);
  });

  it('takes 10 letters a second when the transcript cannot tell, and has no end without times', () => {
    expect(wordsEndSeconds(`[00:10] **S1:** ${'ক'.repeat(100)}`)).toBe(20);
    expect(wordsEndSeconds('no time')).toBeNull();
  });
});

describe('joinRest', () => {
  it('joins only what comes after the time asked about', () => {
    const rest = 'Here is the rest:\n[26:30] repeated\nmore of it\n[28:20] after\nsplit part';
    expect(joinRest('[00:10] **S1:** before\n[26:35] **S1:** a short break\n', rest, 1595, 2832)).toEqual({
      text: '[00:10] **S1:** before\n[26:35] **S1:** a short break\n[28:20] after\nsplit part',
      newLetters: 14, mostlyRepeats: false, noMoreSpeech: false,
    });
    expect(joinRest('[26:35] break', '[26:35] break', 1595, 2832).text).toBe('[26:35] break');
  });

  it('leaves out lines timed after the end of the audio, with the untimed lines that belong to them', () => {
    const [b, c, d] = [talk(2, 30), talk(3, 30), talk(4, 30)];
    const rest = `[05:00] **S2:** ${b}\n[12:00] **S2:** ${c}\nuntimed tail of it\n[09:40] **S2:** ${d}`;
    expect(joinRest(`[00:00] **S1:** ${talk(1, 30)}`, rest, 0, 600).text)
      .toBe(`[00:00] **S1:** ${talk(1, 30)}\n[05:00] **S2:** ${b}\n[09:40] **S2:** ${d}`);
  });

  it('leaves out a second transcription of earlier talk, and says when most of the answer was that', () => {
    const [a, b, fresh] = [talk(1, 80), talk(2, 80), talk(7, 30)];
    const text = `[00:00] **S1:** ${a}\n[01:00] **S2:** ${b}`;
    const rest = `[01:30] **S1:** ${heardAgain(a)}\n[02:10] **S2:** ${heardAgain(b)}\n[03:00] **S1:** ${fresh}`;
    const joined = joinRest(text, rest, 60, 600);
    expect(joined.text).toBe(`${text}\n[03:00] **S1:** ${fresh}`);
    expect(joined.mostlyRepeats).toBe(true);
  });

  it('changes nothing when the model says nobody speaks after that time', () => {
    expect(joinRest('[01:00] **S1:** done', NO_MORE_SPEECH, 60, 600)).toEqual({
      text: '[01:00] **S1:** done', newLetters: 0, mostlyRepeats: false, noMoreSpeech: true,
    });
  });
});
