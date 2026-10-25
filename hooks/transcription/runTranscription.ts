import type { GenerateContentResponse } from '@google/genai';
import { buildTranscriptionRequest, extractResponseText } from './geminiRequest';
import { generateWithRecovery, type BuildRequest } from './geminiTranscriptionRunner';
import { createAudioSource } from './geminiAudioSource';
import { planAudioChunks, type AudioChunk } from './audioChunks';
import { shiftTimestamps } from './timestampShift';
import { emptyTranscriptError } from './transcriptionErrors';

type Lang = 'en' | 'bn';
type Toast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;

interface TranscribeOptions {
  provider: { key: string; source: string };
  modelName: string;
  mode: 'normal' | 'pro';
  lang: Lang;
  setStage: (stage: string) => void;
  addToast: Toast;
}

// Parts of a long recording sent to Gemini at the same time
const PARALLEL_PARTS = 2;
// Answers that asking again would not change
const FINAL_REASONS = ['SAFETY', 'RECITATION', 'MAX_TOKENS'];

// Why an answer has no text: a block of the request, the model's finish reason, or no answer at all
const emptyReasonOf = (response: GenerateContentResponse | null) =>
  response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || 'NO_ANSWER';

// One piece of audio. An empty answer is a failed request, not silence: it is asked once more in exactly
// the same way (never with a looser prompt, which could make the model write words that were not said).
const transcribeOnce = async (blob: Blob, mimeType: string, options: TranscribeOptions) => {
  const { provider, modelName, mode, lang, setStage, addToast } = options;
  const source = createAudioSource(blob, mimeType);
  try {
    const buildRequest: BuildRequest = async (ai, key) => buildTranscriptionRequest(modelName, mode, await source.partFor(ai, key));
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

const transcribeParts = async (parts: AudioChunk[], options: TranscribeOptions) => {
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
      results[index] = await transcribeOnce(parts[index].blob, parts[index].blob.type, partOptions);
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
  if (parts && parts.length > 1) return transcribeParts(parts, options);
  options.setStage(options.lang === 'bn' ? 'এআই সার্ভারে সম্পূর্ণ অডিও বিশ্লেষণ ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Transcribing media on AI server...');
  return { ...(await transcribeOnce(blob, mimeType, options)), parts: 1 };
};
