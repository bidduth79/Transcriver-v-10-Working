// Signs that a new transcript may be wrong, shown on its history card so the user knows which ones to check.
// They only inform: nothing in the transcript is changed. Limits measured on 251 transcripts of 10-23 Oct 2026
// (a clean stretch) against 107 of November, when many went wrong:
//   less than 250 letters a minute ............ clean 0.8%, November 8.4%
//   words end over 5 minutes before the audio .. clean 3.6%, November 7.5%
//   a loop in Gemini's answer .................. clean 2.4%, November 20.6%
//   7+ minutes with almost no text ............. clean 2.4%, November 14%
import type { TranscriptWarning } from '../../types';
import { repeatedShare, LOOP_SHARE } from './textRepetition';
import { wordsEndSeconds } from './transcriptContinuation';
import { timestampsIn } from '../../utils/transcriptTimes';

// Shorter audio has too little speech to judge by its amount
const MIN_JUDGED_SECONDS = 5 * 60;
const MIN_LETTERS_PER_MINUTE = 250;
const ENDS_EARLY_SECONDS = 5 * 60;
const PAST_END_SECONDS = 2 * 60;
const GAP_SECONDS = 7 * 60;
// Speech is about 10 letters a second; a line with under 3 a second over its time is mostly missing
const GAP_LETTERS_PER_SECOND = 3;

const bengaliLetters = (text: string) => (text.match(/[ঀ-৿]/g) || []).length;

// The longest stretch between two timed lines whose text is far too short for it, in seconds
const longestThinStretch = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim());
  let longest = 0;
  for (let i = 0; i + 1 < lines.length; i++) {
    const start = timestampsIn(lines[i])[0]?.seconds;
    const end = timestampsIn(lines[i + 1])[0]?.seconds;
    if (start === undefined || end === undefined || end <= start) continue;
    if (bengaliLetters(lines[i]) / (end - start) < GAP_LETTERS_PER_SECOND) longest = Math.max(longest, end - start);
  }
  return longest;
};

// Against YouTube's captions of the same recording: complete transcripts of the user's talk shows had 83-104% of
// their captions' Bengali letters, a 54-minute one that stopped 12 minutes early about 78%
const MIN_CAPTION_SHARE = 0.8;
// Captions this short say too little to compare with
const MIN_CAPTION_LETTERS = 500;

// `answer` is Gemini's text before repeats were taken out; `text` is the transcript as saved; `captionLetters` the
// Bengali letters of the recording's YouTube captions, when they were found next to it
export const transcriptWarnings = (text: string, answer: string, audioSeconds: number, captionLetters = 0): TranscriptWarning[] => {
  const warnings: TranscriptWarning[] = [];
  if (repeatedShare(answer) >= LOOP_SHARE) warnings.push('loop');
  if (captionLetters >= MIN_CAPTION_LETTERS && bengaliLetters(text) / captionLetters < MIN_CAPTION_SHARE) warnings.push('lessThanCaptions');
  // (an unknown length, NaN, is not judged either)
  if (!(audioSeconds >= MIN_JUDGED_SECONDS)) return warnings;

  if (bengaliLetters(text) / (audioSeconds / 60) < MIN_LETTERS_PER_MINUTE) warnings.push('littleText');
  const wordsEnd = wordsEndSeconds(text);
  // A transcript without times (normal mode) gives no place to compare
  if (wordsEnd === null) return warnings;
  if (audioSeconds - wordsEnd > ENDS_EARLY_SECONDS) warnings.push('endsEarly');
  if (wordsEnd - audioSeconds > PAST_END_SECONDS) warnings.push('pastEnd');
  if (longestThinStretch(text) >= GAP_SECONDS) warnings.push('gap');
  return warnings;
};
