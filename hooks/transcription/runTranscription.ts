import { buildTranscriptionRequest, extractResponseText } from './geminiRequest';
import { generateWithRecovery, retryHighSensitivity, type BuildRequest } from './geminiTranscriptionRunner';
import { createAudioSource } from './geminiAudioSource';
import { planAudioChunks, type AudioChunk } from './audioChunks';
import { shiftTimestamps } from './timestampShift';

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

// One request for one piece of audio, with the key fallbacks and the high-sensitivity retry for empty answers
const transcribeOnce = async (blob: Blob, mimeType: string, options: TranscribeOptions) => {
  const { provider, modelName, mode, lang, setStage, addToast } = options;
  const source = createAudioSource(blob, mimeType);
  try {
    const buildRequest: BuildRequest = async (ai, key) => buildTranscriptionRequest(modelName, mode, await source.partFor(ai, key));
    const result = await generateWithRecovery({ provider, buildRequest, lang, setStage, addToast });
    let response = result.response;
    let text = extractResponseText(response);
    const firstFinishReason = response?.candidates?.[0]?.finishReason;

    // Auto-recovery if no text was produced on first attempt (due to RECITATION, intro music, low volume, or decoder quirk)
    if (!text.trim() && firstFinishReason !== 'SAFETY' && firstFinishReason !== 'MAX_TOKENS') {
      console.warn(`Empty transcript on first attempt (finishReason: ${firstFinishReason}). Retrying with enhanced sensitivity...`);
      setStage(lang === 'bn'
        ? 'কণ্ঠস্বর গভীরভাবে শনাক্ত করতে বিকল্প মোডে পুনরায় চেষ্টা করা হচ্ছে...'
        : 'Retrying with high-sensitivity speech detection...');
      const retryResp = await retryHighSensitivity({ ai: result.ai, apiKey: result.apiKey, audio: source, modelName, inputFile: blob, effectiveMimeType: mimeType });
      const retryText = extractResponseText(retryResp);
      if (retryText.trim()) {
        text = retryText;
        response = retryResp;
      }
    }
    const finishReason: string | undefined = response?.candidates?.[0]?.finishReason;
    return { text, finishReason, source: result.source, keyLabel: result.keyLabel };
  } finally {
    source.cleanup();
  }
};

const transcribeParts = async (parts: AudioChunk[], options: TranscribeOptions) => {
  const { lang, setStage } = options;
  const results: Awaited<ReturnType<typeof transcribeOnce>>[] = new Array(parts.length);
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

  const text = results
    .map((result, i) => shiftTimestamps(result.text.trim(), parts[i].startSeconds))
    .filter(Boolean)
    .join('\n');
  const empty = results.find(result => !result.text.trim());
  const last = results[results.length - 1];
  return { text, finishReason: text ? last.finishReason : empty?.finishReason, source: last.source, keyLabel: last.keyLabel };
};

/**
 * Transcribes prepared audio. Recordings over 30 minutes (WAV or MP3) are cut into parts that are
 * transcribed two at a time and joined with their timestamps moved to the right place; a part that
 * fails is retried on its own by the usual key fallbacks.
 */
export const transcribeAudio = async (blob: Blob, mimeType: string, durationSeconds: number, options: TranscribeOptions) => {
  const parts = await planAudioChunks(blob, mimeType, durationSeconds).catch(() => null);
  if (parts && parts.length > 1) return transcribeParts(parts, options);
  options.setStage(options.lang === 'bn' ? 'এআই সার্ভারে সম্পূর্ণ অডিও বিশ্লেষণ ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Transcribing media on AI server...');
  return transcribeOnce(blob, mimeType, options);
};
