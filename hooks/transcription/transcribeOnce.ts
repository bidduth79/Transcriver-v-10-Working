import type { GenerateContentResponse } from '../../types/gemini';
import { buildTranscriptionRequest, extractResponseText, transcriptionTimeoutMs } from './geminiRequest';
import { generateWithRecovery, type BuildRequest } from './geminiTranscriptionRunner';
import { createAudioSource } from './geminiAudioSource';
import { isNotATranscript } from './answerCheck';
import { repeatedShare } from './textRepetition';
import { uiText } from '../../utils/uiText';

type Lang = 'en' | 'bn';
type Toast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;

export interface TranscribeOptions {
  provider: { key: string; source: string };
  modelName: string;
  mode: 'normal' | 'pro';
  lang: Lang;
  setStage: (stage: string) => void;
  addToast: Toast;
  // Set when asking for the rest of a transcript that stopped at this time ("26:35")
  continueFrom?: string;
}

// Empty answers that asking again would not change
const FINAL_REASONS = ['SAFETY', 'RECITATION', 'MAX_TOKENS', 'PROHIBITED_CONTENT'];
// An answer this much made of repeats went round in a loop (measured: a loop about 0.9, talk shows below 0.1)
const LOOP_SHARE = 0.25;

type Problem = 'EMPTY' | 'NOT_A_TRANSCRIPT' | 'LOOP';

// Why an answer has no text: a block of the request, the model's finish reason, or no answer at all
const emptyReasonOf = (response: GenerateContentResponse | null) =>
  response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || 'NO_ANSWER';

// What is wrong with an answer, if anything. The rest of a transcript is shorter by nature, and its repeats are
// left out when it is joined, so it is only checked for being empty.
const problemOf = (text: string, audioSeconds: number, continueFrom?: string): Problem | null => {
  if (!text.trim()) return 'EMPTY';
  if (continueFrom) return null;
  if (isNotATranscript(text, audioSeconds)) return 'NOT_A_TRANSCRIPT';
  return repeatedShare(text) >= LOOP_SHARE ? 'LOOP' : null;
};

/**
 * One piece of audio. An empty answer is a failed request, not silence. An answer that is empty, not a transcript,
 * or going round in a loop is asked once more from the same model (the user's choice is never changed), with its
 * default settings. The prompt is never made looser, which could make the model write words that were not said.
 * The rest of a transcript that comes back empty is taken as nothing more said, without asking again.
 */
export const transcribeOnce = async (blob: Blob, mimeType: string, audioSeconds: number, options: TranscribeOptions) => {
  const { provider, modelName, mode, lang, setStage, addToast, continueFrom } = options;
  const source = createAudioSource(blob, mimeType);
  try {
    // The time limit follows the audio length, so a stuck request is retried sooner on short audio
    const timeoutMs = transcriptionTimeoutMs(audioSeconds);
    // `clean`: the model's default settings (no lowered temperature or thinking level)
    const requestFor = (clean: boolean): BuildRequest => async (ai, key) => {
      const request = buildTranscriptionRequest(modelName, mode, await source.partFor(ai, key), clean, continueFrom);
      return timeoutMs ? { ...request, config: { ...request.config, timeoutMs } } : request;
    };
    let result = await generateWithRecovery({ provider, buildRequest: requestFor(false), lang, setStage, addToast });
    let text = extractResponseText(result.response);
    let problem = problemOf(text, audioSeconds, continueFrom);
    let requests = 1;
    const final = problem === 'EMPTY' && (continueFrom !== undefined || FINAL_REASONS.includes(emptyReasonOf(result.response)));
    if (problem && !final) {
      console.warn(`${problem} answer from ${modelName} (${emptyReasonOf(result.response)}); asking it once more, with its default settings`);
      setStage(problem === 'LOOP'
        ? uiText(lang, 'answerLoopRetrying')
        : problem === 'EMPTY'
          ? (lang === 'bn' ? 'উত্তর খালি এসেছে, একই ভাবে আবার চেষ্টা করা হচ্ছে...' : 'The answer was empty; asking once more...')
          : (lang === 'bn' ? 'উত্তরটা অডিওর লেখা নয়, একই ভাবে আবার চেষ্টা করা হচ্ছে...' : 'The answer is not a transcript; asking once more...'));
      const retry = await generateWithRecovery({ provider: { key: result.apiKey, source: result.source }, buildRequest: requestFor(true), lang, setStage, addToast });
      const retryText = extractResponseText(retry.response);
      const retryProblem = problemOf(retryText, audioSeconds, continueFrom);
      requests = 2;
      // A loop is still better than no transcript: its repeats are taken out before it is saved
      const keepLoop = problem === 'LOOP' && retryProblem !== null && (retryProblem !== 'LOOP' || repeatedShare(retryText) >= repeatedShare(text));
      if (!keepLoop) {
        result = retry;
        text = retryText;
        problem = retryProblem;
      }
    }
    // Still not a transcript: reported as a failed answer instead of being saved
    const notATranscript = problem === 'NOT_A_TRANSCRIPT';
    if (notATranscript) console.warn(`Answer is not a transcript of ${Math.round(audioSeconds)}s of audio: ${text.slice(0, 120)}`);
    return {
      text: notATranscript ? '' : text,
      finishReason: result.response?.candidates?.[0]?.finishReason as string | undefined,
      emptyReason: notATranscript ? 'NOT_A_TRANSCRIPT' : text.trim() ? undefined : emptyReasonOf(result.response),
      requests,
      source: result.source,
      keyLabel: result.keyLabel,
      // Always the chosen model: the app never changes it by itself
      model: modelName,
    };
  } finally {
    source.cleanup();
  }
};

export type PieceResult = Awaited<ReturnType<typeof transcribeOnce>>;
