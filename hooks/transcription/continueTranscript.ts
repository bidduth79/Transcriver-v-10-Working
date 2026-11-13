import { formatClock } from './timestampShift';
import { lastTimestampSeconds, wordsEndSeconds, joinRest } from './transcriptContinuation';
import { isTranscribeModel } from './transcribeModel';
import { transcribeOnce, type PieceResult, type TranscribeOptions } from './transcribeOnce';
import { uiText } from '../../utils/uiText';

// A transcript whose words end this long before the audio does stopped early (a programme often ends with a
// minute or two of music or credits)
const CONTINUE_WHEN_LEFT_SECONDS = 180;
// Up to this many requests ask for the rest
const MAX_CONTINUATIONS = 3;
// A request that brings less new speech than this (about 15 seconds) is not followed by another
const MIN_NEW_LETTERS = 150;

/**
 * Gemini sometimes takes a long silence in the middle (a programme's break) for the end and stops there. Only when
 * the words of the transcript end early, the rest is asked for with the same whole audio (it is not cut), checked,
 * and joined after what was written. Every request is counted, also one that brought nothing new.
 */
export const continueUntilEnd = async (blob: Blob, mimeType: string, durationSeconds: number, first: PieceResult, options: TranscribeOptions): Promise<PieceResult> => {
  const { lang, setStage, addToast } = options;
  let text = first.text;
  let wordsEnd = wordsEndSeconds(text);
  // A transcribe model takes no written instructions, so it cannot be asked for "the rest"; the model the user
  // chose is never swapped for another, so its transcript is kept as it came
  if (options.mode !== 'pro' || durationSeconds <= 0 || wordsEnd === null || isTranscribeModel(options.modelName)) return first;
  let requests = first.requests;
  let noMoreSpeech = false;
  for (let round = 0; round < MAX_CONTINUATIONS && durationSeconds - wordsEnd > CONTINUE_WHEN_LEFT_SECONDS; round++) {
    const last = lastTimestampSeconds(text) ?? 0;
    const from = formatClock(Math.round(last));
    console.warn(`The words end near ${formatClock(Math.round(wordsEnd))} of ${formatClock(Math.round(durationSeconds))}; asking for what is said after ${from}`);
    setStage(lang === 'bn' ? `লেখা [${from}]-এ থেমে গেছে, বাকি অংশ ট্রান্সক্রাইব করা হচ্ছে...` : `The transcript stopped at [${from}]; transcribing the rest...`);
    const rest = await transcribeOnce(blob, mimeType, durationSeconds, { ...options, continueFrom: from }).catch(() => null);
    requests += rest?.requests ?? 1;
    if (!rest) break;
    const joined = joinRest(text, rest.text, last, durationSeconds);
    text = joined.text;
    wordsEnd = Math.max(wordsEnd, wordsEndSeconds(text) ?? wordsEnd);
    noMoreSpeech = joined.noMoreSpeech;
    if (joined.noMoreSpeech || joined.mostlyRepeats || joined.newLetters < MIN_NEW_LETTERS) break;
  }
  if (!noMoreSpeech && durationSeconds - wordsEnd > CONTINUE_WHEN_LEFT_SECONDS) {
    const at = formatClock(Math.round(lastTimestampSeconds(text) ?? 0));
    addToast(uiText(lang, 'transcriptStoppedEarly', { at, end: formatClock(Math.round(durationSeconds)) }), 'warning');
  }
  return { ...first, text, requests };
};
