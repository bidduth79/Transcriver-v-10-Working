import { planAudioChunks, type AudioChunk } from './audioChunks';
import { shiftTimestamps } from './timestampShift';
import { transcribeOnce, type PieceResult, type TranscribeOptions } from './transcribeOnce';
import { continueUntilEnd } from './continueTranscript';
import { emptyTranscriptError } from './transcriptionErrors';
import { isTranscribeModel, TRANSCRIBE_LIMIT_SECONDS } from './transcribeModel';
import { splitLimits } from './splitPolicy';
import { uiText } from '../../utils/uiText';

// Parts of a long recording sent to Gemini at the same time
const PARALLEL_PARTS = 2;

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
    requests: results.reduce((sum, r) => sum + r.requests, 0), source: last.source, keyLabel: last.keyLabel, model: last.model,
  };
};

/**
 * Transcribes prepared audio. A long recording is cut into parts where that does better (splitPolicy: Lite and
 * transcribe models, WAV/MP3 over 30 minutes; the user can turn it off), transcribed two at a time and joined
 * with their timestamps moved to the right place; a part that fails is retried on its own by the usual key
 * fallbacks. The model the user chose is used as it is.
 */
export const transcribeAudio = async (blob: Blob, mimeType: string, durationSeconds: number, options: TranscribeOptions) => {
  const limits = splitLimits(options.modelName, options.mode);
  const parts = await planAudioChunks(blob, mimeType, durationSeconds, limits).catch(() => null);
  if (parts && parts.length > 1) return transcribeParts(parts, durationSeconds, options);
  // Sent whole past Google's limit, a transcribe model silently stops before the end: said before it starts
  const limit = TRANSCRIBE_LIMIT_SECONDS[options.mode];
  if (isTranscribeModel(options.modelName) && durationSeconds > limit) {
    options.addToast(uiText(options.lang, options.mode === 'pro' ? 'transcribeLongAudioPro' : 'transcribeLongAudioNormal', { minutes: Math.round(durationSeconds / 60) }), 'warning');
  }
  options.setStage(options.lang === 'bn' ? 'এআই সার্ভারে সম্পূর্ণ অডিও বিশ্লেষণ ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Transcribing media on AI server...');
  const result = await transcribeOnce(blob, mimeType, durationSeconds, options);
  return { ...(await continueUntilEnd(blob, mimeType, durationSeconds, result, options)), parts: 1 };
};
