import type { GenerateContentResponse } from '../../types/gemini';
import { buildTranscriptionRequest, extractResponseText, transcriptionTimeoutMs } from './geminiRequest';
import { generateWithRecovery, type BuildRequest } from './geminiTranscriptionRunner';
import { createAudioSource } from './geminiAudioSource';
import { planAudioChunks, type AudioChunk } from './audioChunks';
import { shiftTimestamps, formatClock } from './timestampShift';
import { lastTimestampSeconds, appendContinuation } from './transcriptContinuation';
import { isTranscribeModel, LONG_AUDIO_MODEL } from './transcribeModel';
import { uiText } from '../../utils/uiText';
import { emptyTranscriptError } from './transcriptionErrors';
import { OVERLOAD_FALLBACK_MODEL } from '../../services/apiKeys/geminiClient';

type Lang = 'en' | 'bn';
type Toast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;

interface TranscribeOptions {
  provider: { key: string; source: string };
  modelName: string;
  mode: 'normal' | 'pro';
  lang: Lang;
  setStage: (stage: string) => void;
  addToast: Toast;
  // Set when asking for the rest of a transcript that stopped at this time ("26:35")
  continueFrom?: string;
}

// Parts of a long recording sent to Gemini at the same time
const PARALLEL_PARTS = 2;
// A transcript ending this much before the audio does stopped early; up to this many requests ask for the rest
const CONTINUE_WHEN_LEFT_SECONDS = 120;
const MAX_CONTINUATIONS = 3;
// Answers that asking again would not change
const FINAL_REASONS = ['SAFETY', 'RECITATION', 'MAX_TOKENS'];

// Why an answer has no text: a block of the request, the model's finish reason, or no answer at all
const emptyReasonOf = (response: GenerateContentResponse | null) =>
  response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || 'NO_ANSWER';

// One piece of audio. An empty answer is a failed request, not silence: it is asked once more in exactly
// the same way (never with a looser prompt, which could make the model write words that were not said).
const transcribeOnce = async (blob: Blob, mimeType: string, audioSeconds: number, options: TranscribeOptions) => {
  const { provider, modelName, mode, lang, setStage, addToast, continueFrom } = options;
  const source = createAudioSource(blob, mimeType);
  try {
    // The time limit follows the audio length, so a stuck request is retried sooner on short audio
    const timeoutMs = transcriptionTimeoutMs(audioSeconds);
    const buildRequest: BuildRequest = async (ai, key) => {
      const request = buildTranscriptionRequest(modelName, mode, await source.partFor(ai, key), false, continueFrom);
      return timeoutMs ? { ...request, config: { ...request.config, timeoutMs } } : request;
    };
    let result = await generateWithRecovery({ provider, buildRequest, lang, setStage, addToast });
    let text = extractResponseText(result.response);
    let requests = 1;
    if (!text.trim() && !FINAL_REASONS.includes(emptyReasonOf(result.response))) {
      console.warn(`Empty answer (${emptyReasonOf(result.response)}); asking once more with the same request`);
      setStage(lang === 'bn' ? 'উত্তর খালি এসেছে, একই ভাবে আবার চেষ্টা করা হচ্ছে...' : 'The answer was empty; asking once more...');
      result = await generateWithRecovery({ provider: { key: result.apiKey, source: result.source }, buildRequest, lang, setStage, addToast });
      text = extractResponseText(result.response);
      requests = 2;
    }
    // When Gemini aborts twice with finishReason OTHER (e.g. model/low-temperature/thinkingConfig abort),
    // try once more with the fallback model and default temperature/thinking while keeping the same prompt.
    if (!text.trim() && emptyReasonOf(result.response) === 'OTHER') {
      const fallbackModel = OVERLOAD_FALLBACK_MODEL[modelName] || (modelName !== 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash-lite' : modelName);
      console.warn(`Empty answer (OTHER) persisted; retrying with ${fallbackModel} and default generation config`);
      setStage(lang === 'bn' ? `বিকল্প মডেল (${fallbackModel}) দিয়ে পুনরায় চেষ্টা করা হচ্ছে...` : `Retrying with fallback model (${fallbackModel})...`);
      const buildFallback: BuildRequest = async (ai, key) => buildTranscriptionRequest(fallbackModel, mode, await source.partFor(ai, key), true, continueFrom);
      result = await generateWithRecovery({ provider: { key: result.apiKey, source: result.source }, buildRequest: buildFallback, lang, setStage, addToast });
      text = extractResponseText(result.response);
      requests = 3;
    }
    return {
      text,
      finishReason: result.response?.candidates?.[0]?.finishReason as string | undefined,
      emptyReason: text.trim() ? undefined : emptyReasonOf(result.response),
      requests,
      source: result.source,
      keyLabel: result.keyLabel,
    };
  } finally {
    source.cleanup();
  }
};

type PieceResult = Awaited<ReturnType<typeof transcribeOnce>>;

// Gemini sometimes takes a long silence in the middle (a programme's break) for the end and stops there.
// The rest is asked for with the same whole audio (it is not cut), and joined after what was written.
const continueUntilEnd = async (blob: Blob, mimeType: string, durationSeconds: number, first: PieceResult, options: TranscribeOptions) => {
  const { lang, setStage, addToast } = options;
  let result = first;
  let last = lastTimestampSeconds(result.text);
  if (options.mode !== 'pro' || durationSeconds <= 0 || last === null) return result;
  // A transcribe model takes no written instructions, so the general model writes the rest
  const modelName = isTranscribeModel(options.modelName) ? LONG_AUDIO_MODEL : options.modelName;
  for (let round = 0; round < MAX_CONTINUATIONS && durationSeconds - last > CONTINUE_WHEN_LEFT_SECONDS; round++) {
    const from = formatClock(last);
    console.warn(`Transcript stopped at ${from} of ${formatClock(Math.round(durationSeconds))}; asking for the rest`);
    setStage(lang === 'bn' ? `লেখা [${from}]-এ থেমে গেছে, বাকি অংশ ট্রান্সক্রাইব করা হচ্ছে...` : `The transcript stopped at [${from}]; transcribing the rest...`);
    const rest = await transcribeOnce(blob, mimeType, durationSeconds, { ...options, modelName, continueFrom: from }).catch(() => null);
    const text: string = rest ? appendContinuation(result.text, rest.text, last) : result.text;
    if (!rest || text === result.text) break;
    result = { ...rest, text, requests: result.requests + rest.requests };
    last = lastTimestampSeconds(text) ?? last;
  }
  if (durationSeconds - last > CONTINUE_WHEN_LEFT_SECONDS) {
    addToast(uiText(lang, 'transcriptStoppedEarly', { at: formatClock(last), end: formatClock(Math.round(durationSeconds)) }), 'warning');
  }
  return result;
};

const transcribeParts = async (parts: AudioChunk[], totalSeconds: number, options: TranscribeOptions) => {
  const { lang, setStage } = options;
  const results: PieceResult[] = new Array(parts.length);
  let next = 0;
  let done = 0;
  const showProgress = () => setStage(lang === 'bn'
    ? `লম্বা অডিও ${parts.length}টি অংশে ট্রান্সক্রাইব হচ্ছে (${done}/${parts.length} সম্পন্ন)...`
    : `Transcribing a long recording in ${parts.length} parts (${done}/${parts.length} done)...`);
  // Stage messages from the requests themselves (rate-limit waits, key switches) still show
  const partOptions = { ...options, setStage };

  showProgress();
  const worker = async () => {
    while (next < parts.length) {
      const index = next++;
      const partSeconds = (parts[index + 1]?.startSeconds ?? totalSeconds) - parts[index].startSeconds;
      results[index] = await transcribeOnce(parts[index].blob, parts[index].blob.type, partSeconds, partOptions);
      done++;
      showProgress();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, parts.length) }, worker));

  // A part without text would leave a silent gap in the middle of the transcript
  const emptyIndex = results.findIndex(result => !result.text.trim());
  if (emptyIndex !== -1) {
    throw emptyTranscriptError(results[emptyIndex].emptyReason, lang, { part: emptyIndex + 1, parts: parts.length });
  }
  const text = results.map((result, i) => shiftTimestamps(result.text.trim(), parts[i].startSeconds)).join('\n');
  const last = results[results.length - 1];
  return {
    text, finishReason: last.finishReason, emptyReason: undefined, parts: parts.length,
    requests: results.reduce((sum, r) => sum + r.requests, 0), source: last.source, keyLabel: last.keyLabel,
  };
};

/**
 * Transcribes prepared audio. Recordings over 30 minutes (WAV or MP3) are cut into parts that
 * are transcribed two at a time and joined with their timestamps moved to the right place; a part that
 * fails is retried on its own by the usual key fallbacks.
 */
export const transcribeAudio = async (blob: Blob, mimeType: string, durationSeconds: number, options: TranscribeOptions) => {
  const parts = await planAudioChunks(blob, mimeType, durationSeconds).catch(() => null);
  if (parts && parts.length > 1) return transcribeParts(parts, durationSeconds, options);
  options.setStage(options.lang === 'bn' ? 'এআই সার্ভারে সম্পূর্ণ অডিও বিশ্লেষণ ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Transcribing media on AI server...');
  const result = await transcribeOnce(blob, mimeType, durationSeconds, options);
  return { ...(await continueUntilEnd(blob, mimeType, durationSeconds, result, options)), parts: 1 };
};
