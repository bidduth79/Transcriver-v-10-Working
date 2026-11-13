// Lines a model wrote a second time with their original times. Seen with gemini-3.5-transcribe on a 54-minute talk
// show: after 42:16 it wrote 9:41-11:01 again (same times, same speakers, nearly the same words) instead of going on.
// Real talk never comes back to an earlier moment, so a line that jumps far back to the exact time and speaker of a
// line already written, with mostly the same words, is that copy. Kept: a line that only jumps back (a wrong time
// on new words), and new words that share a time and speaker (older models often repeated a time: in the saved
// history 301 such lines had other words, against 2,547 true copies).
import { timestampsIn } from '../../utils/transcriptTimes';
import { comparableText } from './textRepetition';

// Times only go back this far by mistake in a new line, never by a copy
const BACK_SECONDS = 60;
// Share of a line's 4-letter pieces the earlier line must have: copies in the history reach 0.6 and more
const SAME_WORDS = 0.6;

const piecesOf = (text: string) => {
  const letters = comparableText(text);
  const pieces = new Set<string>();
  for (let i = 0; i + 4 <= letters.length; i++) pieces.add(letters.slice(i, i + 4));
  return { letters, pieces };
};

const sameWords = (line: string, earlier: string) => {
  const a = piecesOf(line);
  const b = piecesOf(earlier);
  if (a.letters === b.letters) return true;
  return a.pieces.size > 0 && [...a.pieces].filter(piece => b.pieces.has(piece)).length / a.pieces.size >= SAME_WORDS;
};

const SPEAKER = /^\s*[[(][^\])]*[\])]\s*\*\*([^*]+)\*\*/;

// Where a line starts: its time and speaker, when it starts with a time
const startOf = (line: string) => {
  const time = timestampsIn(line)[0];
  if (!time || line.slice(0, time.index).trim()) return null;
  return { seconds: time.seconds, speaker: line.match(SPEAKER)?.[1].replace(/:$/, '').trim() ?? '' };
};

export const removeTimedCopies = (text: string) => {
  // The first line written at each time by each speaker
  const written = new Map<string, string>();
  let latest = -1;
  // Lines without a time of their own belong to the timed line above them and go with it
  let droppingUntimed = false;
  const kept = text.split('\n').filter(line => {
    const start = startOf(line);
    if (!start) return !(droppingUntimed && line.trim());
    const key = `${start.seconds}|${start.speaker}`;
    const earlier = written.get(key);
    const copy = start.seconds < latest - BACK_SECONDS && earlier !== undefined && sameWords(line, earlier);
    droppingUntimed = copy;
    if (copy) return false;
    if (earlier === undefined) written.set(key, line);
    latest = Math.max(latest, start.seconds);
    return true;
  });
  return kept.join('\n');
};
