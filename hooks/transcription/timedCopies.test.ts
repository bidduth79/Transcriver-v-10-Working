import { describe, it, expect } from 'vitest';
import { removeTimedCopies } from './timedCopies';
import { cleanTranscript } from './textRepetition';

// The shape of a 54-minute transcribe answer: the talk up to 42:16, then 9:41-10:44 written again with their times
const talk = [
  '[09:41] **Speaker 1:** উনি বলছেন পরিত্যক্ত বাড়ি',
  '[09:43] **Speaker 4:** না সে প্রশ্নই করছি জি',
  '[09:46] **Speaker 4:** বিষয়টা আপনি কিভাবে মূল্যায়ন করছেন',
  'হ্যাঁ তো উনার টোনে যদি উনার',
  '[10:44] **Speaker 1:** না না না আমরা তো মনে করি যে ভাই এরকম কুশল কুশল হবে',
  '[41:10] **Speaker 2:** এটা প্রোটোকল না বলতে পারে',
  '[42:16] **Speaker 4:** জি',
];
const copy = [
  '[09:41] **Speaker 1:** উনি বলছেন পরিত্যক্ত বাড়ি',
  '[09:43] **Speaker 4:** না সে প্রশ্নই করছি জি',
  '[09:46] **Speaker 4:** বিষয়টা আপনি কিভাবে মূল্যায়ন করছেন',
  'হ্যাঁ তো उনার টোনে যদি উনার',
  '[10:44] **Speaker 1:** না না না আমরা তো মনে করি যে ভাই এরকম কুশл কুশл হবে your',
];

describe('removeTimedCopies', () => {
  it('drops lines written again far back at the time and speaker of a line already there, with their untimed lines', () => {
    expect(removeTimedCopies([...talk, ...copy].join('\n'))).toBe(talk.join('\n'));
    expect(cleanTranscript([...talk, ...copy].join('\n'))).not.toContain('কুশл');
  });

  it('keeps new words that only share an earlier time: alone, with another speaker, or even with the same speaker', () => {
    const wrongTime = [...talk, '[16:45] **Speaker 4:** চিন্তাধারার পরিবর্তন তো লাগবেই অনেক ধন্যবাদ', '[09:41] **Speaker 2:** অন্য একজন',
      '[09:43] **Speaker 4:** এখন বিএনপির পরিচয় দিয়ে তাদের রাজনীতি করতে হয়'];
    expect(removeTimedCopies(wrongTime.join('\n'))).toBe(wrongTime.join('\n'));
  });

  it('leaves a transcript whose times only go forward, or that has no times, as it is', () => {
    expect(removeTimedCopies(talk.join('\n'))).toBe(talk.join('\n'));
    expect(removeTimedCopies('একটি অনুচ্ছেদ।\n\nআরেকটি অনুচ্ছেদ।')).toBe('একটি অনুচ্ছেদ।\n\nআরেকটি অনুচ্ছেদ।');
  });
});
