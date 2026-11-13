// Asking for the rest of a transcript that stopped early, and joining it safely.
// Gemini sometimes takes a long silence in the middle of a programme (a break) for the end and stops there.
// But a transcript is not unfinished just because its last timestamp is early: the model may write few timestamps
// (its last paragraph then covers minutes), or the audio may end with music or credits. Asked for "the rest" of a
// finished transcript, the model writes the same talk again with new times, or makes some up (seen in saved
// transcripts, even with times after the end of the audio). So the rest is asked for only when the words
// themselves end early, and what comes back is checked before it is joined.
import { timestampsIn } from '../../utils/transcriptTimes';
import { comparableText, paragraphPieces, repeatsOf } from './textRepetition';
import { NO_MORE_SPEECH } from '../../constants/instructions';

// Letters a second of speech gives (talk shows measured 11 to 15). The default is on the low side, so words are
// taken to last longer and a finished transcript is not asked to go on.
const DEFAULT_LETTERS_PER_SECOND = 10;
// A rate read from the transcript outside this range comes from long music or a broken timestamp
const MIN_LETTERS_PER_SECOND = 6;
const MAX_LETTERS_PER_SECOND = 16;
// The rate is read from the transcript only over at least this much timed audio
const MIN_TIMED_SECONDS = 120;
// Lines timed this far after the end of the audio were not heard in it
const PAST_END_TOLERANCE_SECONDS = 30;

// Seconds of the latest timestamp in the transcript, or null when it has none
export const lastTimestampSeconds = (text: string) =>
  timestampsIn(text).reduce<number | null>((latest, time) => (latest === null || time.seconds > latest ? time.seconds : latest), null);

// Where the words of the transcript end, in seconds of audio: its latest time, plus how long the words written
// after it take to say. The speed of speech is read from the timed part of the transcript when it can be.
export const wordsEndSeconds = (text: string): number | null => {
  const times = timestampsIn(text);
  if (times.length === 0) return null;
  const first = times[0];
  const last = times.reduce((latest, time) => (time.seconds >= latest.seconds ? time : latest));
  const span = last.seconds - first.seconds;
  const timedLetters = comparableText(text.slice(first.index, last.index)).length;
  const rate = span >= MIN_TIMED_SECONDS && timedLetters > 0
    ? Math.min(MAX_LETTERS_PER_SECOND, Math.max(MIN_LETTERS_PER_SECOND, timedLetters / span))
    : DEFAULT_LETTERS_PER_SECOND;
  return last.seconds + comparableText(text.slice(last.index)).length / rate;
};

export interface JoinedRest {
  // The transcript with the new speech joined (the same text when there is none)
  text: string;
  // Letters of new speech joined
  newLetters: number;
  // More of the answer repeated the transcript than was new: asking again would bring the same
  mostlyRepeats: boolean;
  // The model said nobody speaks after that time
  noMoreSpeech: boolean;
}

/**
 * The rest checked and joined. Left out: lines up to `afterSeconds` (already written), lines timed after the end
 * of the audio with the untimed lines that belong to them (not heard in it), and talk the transcript already has
 * (a second copy), with the untimed pieces right after such a copy.
 */
export const joinRest = (text: string, rest: string, afterSeconds: number, durationSeconds: number): JoinedRest => {
  const noMoreSpeech = rest.includes(NO_MORE_SPEECH);
  const lines = rest.split(NO_MORE_SPEECH).join('').split('\n');
  const nothing: JoinedRest = { text, newLetters: 0, mostlyRepeats: false, noMoreSpeech };
  const start = lines.findIndex(line => (timestampsIn(line)[0]?.seconds ?? -1) > afterSeconds);
  if (start === -1) return nothing;

  const heard: string[] = [];
  let pastEnd = false;
  for (const line of lines.slice(start)) {
    const time = timestampsIn(line)[0];
    if (time) pastEnd = durationSeconds > 0 && time.seconds > durationSeconds + PAST_END_TOLERANCE_SECONDS;
    if (!pastEnd) heard.push(line);
  }

  const pieces = paragraphPieces(heard.join('\n'));
  const repeats = repeatsOf(pieces, text);
  const kept: string[] = [];
  let repeatedLetters = 0;
  let previousLeftOut = false;
  pieces.forEach((piece, i) => {
    const leaveOut = repeats[i] ?? (previousLeftOut && timestampsIn(piece).length === 0);
    previousLeftOut = leaveOut;
    if (leaveOut) repeatedLetters += comparableText(piece).length;
    else kept.push(piece);
  });

  const added = kept.join('\n').trim();
  const newLetters = comparableText(added).length;
  const mostlyRepeats = repeatedLetters > newLetters;
  if (!added) return { ...nothing, mostlyRepeats };
  return { text: `${text.trimEnd()}\n${added}`, newLetters, mostlyRepeats, noMoreSpeech };
};
