// When a long recording is sent in parts of about 14 minutes (Settings → System: "Split long audio", on unless the
// user turns it off). Only where parts were measured to do better, on the user's own talk shows:
// - Lite models: a whole 36- or 44-minute show went round in loops (38-77% repeats) or stopped at 32 minutes; in
//   parts it was complete with no repeats. They allow 500 requests a day, so parts cost little.
// - The transcribe model past Google's limit for its mode (30 minutes with speakers and times, 1 hour smart): sent
//   whole, the rest is dropped silently. Speakers are numbered again in each part.
// - WAV and MP3 over 30 minutes, as before.
// Flash and Hydrogen get Ogg Opus whole: whole, a 44-minute show came back complete (104% of its captions), and
// parts would spend about 4 of their 20 requests a day on one file.
import { SPLIT_FROM_SECONDS, type SplitLimits } from './audioChunks';
import { isTranscribeModel, TRANSCRIBE_LIMIT_SECONDS } from './transcribeModel';

const SPLIT_STORAGE = 'split_long_audio';
const LITE_SPLIT_FROM_SECONDS = 20 * 60;

export const isSplittingOn = () => {
  try {
    return localStorage.getItem(SPLIT_STORAGE) !== 'off';
  } catch {
    return true;
  }
};

export const setSplittingOn = (on: boolean) => {
  try {
    localStorage.setItem(SPLIT_STORAGE, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the switch goes back to on when the page is opened again
  }
};

export const splitLimits = (model: string, mode: 'normal' | 'pro'): SplitLimits => {
  if (!isSplittingOn()) return { ogg: null, other: null };
  if (/lite/.test(model)) return { ogg: LITE_SPLIT_FROM_SECONDS, other: LITE_SPLIT_FROM_SECONDS };
  if (isTranscribeModel(model)) return { ogg: TRANSCRIBE_LIMIT_SECONDS[mode], other: TRANSCRIBE_LIMIT_SECONDS[mode] };
  return { ogg: null, other: SPLIT_FROM_SECONDS };
};
