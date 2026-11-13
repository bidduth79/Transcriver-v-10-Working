import { describe, it, expect } from 'vitest';
import { comparableText, repeatedShare, removeRepeatedPieces, repeatsOf, cleanTranscript } from './textRepetition';

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

const a = talk(1, 80);
const b = talk(2, 80);

describe('comparableText', () => {
  it('keeps only letters, vowel signs and digits', () => {
    expect(comparableText('[01:15] **Speaker 1:** আমি [অস্পষ্ট] বললাম, "না।" 5')).toBe('আমিবললামনা5');
  });
});

describe('repeatedShare', () => {
  it('is nothing for talk that keeps moving on, and about half when the second half repeats the first', () => {
    expect(repeatedShare([a, b, talk(3, 80)].join('\n'))).toBe(0);
    expect(repeatedShare([a, b, a, b].join('\n'))).toBeCloseTo(0.5, 1);
  });

  it('finds a loop written as one long line without sentence ends', () => {
    expect(repeatedShare(Array(8).fill(talk(5, 60)).join(' '))).toBeGreaterThan(0.7);
  });
});

describe('removeRepeatedPieces', () => {
  it('takes out a second copy of a paragraph, but keeps the first and short lines said twice', () => {
    const text = `[00:00] **S1:** ${a}\n[01:00] **S2:** জি।\n[02:00] **S1:** ${b}\n[03:00] **S2:** জি।\n[04:00] **S1:** ${a}`;
    expect(removeRepeatedPieces(text)).toBe(`[00:00] **S1:** ${a}\n[01:00] **S2:** জি।\n[02:00] **S1:** ${b}\n[03:00] **S2:** জি।`);
  });

  it('returns a text without repeats exactly as it was', () => {
    const text = `[00:00] **S1:** ${a}\n\n[02:00] **S1:** ${b}\n`;
    expect(removeRepeatedPieces(text)).toBe(text);
  });

  it('cuts a loop down to the first time round', () => {
    const once = talk(5, 60);
    const out = removeRepeatedPieces(`[00:00] **S1:** ${Array(8).fill(once).join(' ')}`);
    expect(out.length).toBeLessThan(once.length * 2);
    expect(out.startsWith(`[00:00] **S1:** ${once.slice(0, 50)}`)).toBe(true);
  });
});

describe('repeatsOf', () => {
  it('knows a second transcription of earlier talk, new talk, and pieces too short to tell', () => {
    expect(repeatsOf([heardAgain(a), talk(9, 80), 'জি।'], [a, b].join('\n'))).toEqual([true, false, null]);
  });
});

describe('cleanTranscript', () => {
  it('takes out a near copy that the exact-repeat cleanup misses', () => {
    const nearCopy = a.replace(/^\S+/, 'different');
    expect(cleanTranscript(`[00:00] **S1:** ${a}\n[05:00] **S1:** ${nearCopy}`)).toBe(`[00:00] **S1:** ${a}`);
  });
});
