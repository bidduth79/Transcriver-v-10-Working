// Finding talk that a transcript says twice. A looping answer writes the same stretch again and again, and the
// rest of an unfinished transcript can repeat what was already written. A model that transcribes the same speech
// again changes a few words, so pieces are compared by the short letter sequences they share, not word for word.
// The limits below were measured on the app's own saved transcripts (October-November 2026).
import { removeRepetitiveBlocks, splitLongParagraphs } from './textCleanup';
import { TIMESTAMP_SOURCE } from '../../utils/transcriptTimes';

const TIMES = new RegExp(TIMESTAMP_SOURCE, 'g');

// Only letters, vowel signs and digits: times, speaker names, bracketed marks, punctuation and spaces are left out
export const comparableText = (text: string) =>
  text.replace(TIMES, '').replace(/\*\*[^*]*\*\*/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^\p{L}\p{M}\p{N}]/gu, '');

const sequencesOf = (text: string, size: number) => {
  const letters = comparableText(text);
  const sequences: string[] = [];
  for (let i = 0; i + size <= letters.length; i++) sequences.push(letters.slice(i, i + size));
  return sequences;
};

const shareIn = (sequences: Iterable<string>, known: Set<string>) => {
  let found = 0;
  let total = 0;
  for (const sequence of sequences) {
    total++;
    if (known.has(sequence)) found++;
  }
  return total ? found / total : 0;
};

// Text without sentence ends (a loop often has none) is cut at spaces into pieces of about this length
const PIECE_CHARS = 400;
const MAX_PIECE_CHARS = 600;

const chunksOf = (line: string): string[] => {
  if (line.length <= MAX_PIECE_CHARS) return [line];
  const chunks: string[] = [];
  let rest = line.trim();
  while (rest.length > MAX_PIECE_CHARS) {
    const space = rest.lastIndexOf(' ', PIECE_CHARS);
    const cut = space > PIECE_CHARS / 2 ? space : PIECE_CHARS;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
};

// A text's paragraphs, long ones cut at sentence ends (as they are shown)
export const paragraphPieces = (text: string) =>
  splitLongParagraphs(text).split('\n').map(line => line.trim()).filter(Boolean);

// The pieces a text is compared in: its paragraphs, and long text without sentence ends cut at spaces
const comparablePieces = (text: string) => paragraphPieces(text).flatMap(chunksOf);

// Six-letter sequences: new speech rarely shares nine in ten of them with earlier talk by chance
const LOOP_SEQUENCE = 6;
const REPEAT_SHARE = 0.9;
// Pieces with fewer sequences are not judged, and a piece is taken out only when it is longer still
// (a "yes", a greeting or a thank-you may well be said twice)
const MIN_JUDGED = 30;
const MIN_TAKEN_OUT = 80;

// Share of the transcript (0 to 1) that only repeats what was written before it.
// Measured: a looping answer about 0.9; talk shows below 0.1 (only 2% of them reach 0.25).
export const repeatedShare = (text: string): number => {
  const seen = new Set<string>();
  let repeated = 0;
  let judged = 0;
  for (const piece of comparablePieces(text)) {
    const sequences = sequencesOf(piece, LOOP_SEQUENCE);
    if (sequences.length >= MIN_JUDGED) {
      const letters = sequences.length + LOOP_SEQUENCE - 1;
      judged += letters;
      if (shareIn(sequences, seen) >= REPEAT_SHARE) repeated += letters;
    }
    sequences.forEach(sequence => seen.add(sequence));
  }
  return judged ? repeated / judged : 0;
};

// The text without the pieces that only repeat earlier talk; the first time something is said stays
export const removeRepeatedPieces = (text: string): string => {
  const seen = new Set<string>();
  let changed = false;
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    const chunks = chunksOf(line);
    const kept = chunks.filter(chunk => {
      const sequences = sequencesOf(chunk, LOOP_SEQUENCE);
      const repeat = sequences.length >= MIN_TAKEN_OUT && shareIn(sequences, seen) >= REPEAT_SHARE;
      sequences.forEach(sequence => seen.add(sequence));
      return !repeat;
    });
    if (kept.length === chunks.length) lines.push(line);
    else {
      changed = true;
      if (kept.length) lines.push(kept.join(' '));
    }
  }
  return changed ? lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() : text;
};

// Five-letter sequences tell a second transcription of the same talk: measured, such a copy shares at least half
// of them with the earlier text (most 0.75 to 0.9), while only 0.35% of new paragraphs do. Short pieces share
// sequences by chance more often, so they must share more.
const COPY_SEQUENCE = 5;
const COPY_SHARE = 0.5;
const SHORT_PIECE = 60;
const SHORT_COPY_SHARE = 0.75;
const MIN_COMPARED = 20;

// For each piece, whether it repeats the transcript: true, false, or null when it is too short to tell.
// A piece is compared with every two neighbouring pieces of the transcript, so a copy that runs across a
// paragraph break is still found.
export const repeatsOf = (pieces: string[], transcript: string): (boolean | null)[] => {
  const earlier = comparablePieces(transcript).map(piece => new Set(sequencesOf(piece, COPY_SEQUENCE)));
  const windows = earlier.map((sequences, i) => (i + 1 < earlier.length ? new Set([...sequences, ...earlier[i + 1]]) : sequences));
  return pieces.map(piece => {
    const sequences = new Set(sequencesOf(piece, COPY_SEQUENCE));
    if (sequences.size < MIN_COMPARED) return null;
    const needed = sequences.size < SHORT_PIECE ? SHORT_COPY_SHARE : COPY_SHARE;
    return windows.some(window => shareIn(sequences, window) >= needed);
  });
};

// The saved form of an answer: repeats taken out, long paragraphs split for reading
export const cleanTranscript = (text: string) =>
  removeRepeatedPieces(splitLongParagraphs(removeRepetitiveBlocks(text)));
