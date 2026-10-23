import { GoogleGenAI } from "@google/genai";
import type { AudioSource } from './geminiAudioSource';
import { parseRateLimit, rateLimitWaitMs, sleepMs } from './rateLimit';
import { getFallbackProviders, setActiveApiKey } from '../../services/ApiKeyManager';
import { detectAudioMimeType, convertAudioToWav, blobToBase64 } from './transcriptionUtils';
import { isKeyOrProjectBlockedError } from './transcriptionErrors';
import { buildHighSensitivityRequest, releaseRequestAudio } from './geminiRequest';
import { createGeminiClient } from '../../services/apiKeys/geminiClient';

type Lang = 'bn' | 'en';
type Toast = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;

const SMALL_FILE_LIMIT = 1 * 1024 * 1024;

export const keyLabelOf = (source: string, key: string) => `${source} (****${key.slice(-4)})`;

// Sniff accurate MIME type from magic bytes and filename (fixes audio/opus and WhatsApp voice notes)
export const prepareAudio = async (inputFile: Blob, fileName: string) => {
  const lowerName = fileName.toLowerCase();
  const sniffed = await detectAudioMimeType(inputFile, fileName);
  let effectiveMimeType = sniffed.mimeType || inputFile.type || 'audio/mp3';
  if (effectiveMimeType.includes('opus') || lowerName.endsWith('.opus') || lowerName.endsWith('.ogg')) {
    effectiveMimeType = 'audio/ogg';
  }

  let effectiveFile: Blob = inputFile;

  // For small voice notes / clips (<= 1MB), normalize quiet audio into 16kHz mono PCM WAV
  if (inputFile.size <= SMALL_FILE_LIMIT && (sniffed.isOggOpus || sniffed.isWhatsApp || lowerName.endsWith('.opus') || lowerName.endsWith('.ogg'))) {
    const wavConverted = await convertAudioToWav(inputFile, 16000);
    if (wavConverted && wavConverted.wavBlob) {
      effectiveFile = wavConverted.wavBlob;
      effectiveMimeType = 'audio/wav';
    }
  }
  return { effectiveFile, effectiveMimeType };
};

// Builds the request for a given key (large audio is uploaded per key)
export type BuildRequest = (ai: GoogleGenAI, apiKey: string) => Promise<any>;

interface RecoveryOptions {
  provider: { key: string; source: string };
  buildRequest: BuildRequest;
  lang: Lang;
  setStage: (stage: string) => void;
  addToast: Toast;
}

// A per-minute rate limit: wait as long as Gemini asks (at most 2 minutes), then try the same key once more
const generateWaitingOnRateLimit = async (ai: GoogleGenAI, request: any, lang: Lang, setStage: (stage: string) => void) => {
  try {
    return await ai.models.generateContent(request);
  } catch (err) {
    const waitMs = rateLimitWaitMs(parseRateLimit(err));
    if (waitMs === null) throw err;
    const secs = Math.round(waitMs / 1000);
    setStage(lang === 'bn' ? `রেট লিমিট: ${secs} সেকেন্ড অপেক্ষা করে আবার চেষ্টা করা হচ্ছে...` : `Rate limit: retrying in ${secs}s...`);
    await sleepMs(waitMs);
    return await ai.models.generateContent(request);
  }
};

// Calls Gemini; on blocked/quota errors tries fallback keys, and drops thinkingConfig if a model rejects it.
export const generateWithRecovery = async ({ provider, buildRequest, lang, setStage, addToast }: RecoveryOptions) => {
  let ai = createGeminiClient(provider.key);
  let apiKey = provider.key;
  let request: any = null;
  let source = provider.source;
  let keyLabel = keyLabelOf(provider.source, provider.key);
  let response: any = null;

  try {
    request = await buildRequest(ai, provider.key);
    response = await generateWaitingOnRateLimit(ai, request, lang, setStage);
  } catch (err: any) {
    console.error("Transcription generation failed on primary key:", err);
    if (err?.message?.includes('RECITATION') || err?.message?.includes('Recitation')) {
      console.warn("Caught recitation in generateContent error");
    } else if (isKeyOrProjectBlockedError(err)) {
      const fallbacks = await getFallbackProviders(provider.key);
      let recoveredWithFallback = false;

      for (const fb of fallbacks) {
        try {
          setStage(lang === 'bn'
            ? `বিকল্প এপিআই কি (${fb.source}) দিয়ে পুনরায় চেষ্টা করা হচ্ছে...`
            : `Retrying with alternate API Key (${fb.source})...`);
          const fbAi = createGeminiClient(fb.key);
          releaseRequestAudio(request);
          request = await buildRequest(fbAi, fb.key);
          response = await fbAi.models.generateContent(request);
          ai = fbAi;
          apiKey = fb.key;
          source = fb.source;
          keyLabel = keyLabelOf(fb.source, fb.key);
          // A per-minute limit passes by itself, so the working key becomes the default only for lasting problems
          const limit = parseRateLimit(err);
          if (fb.id && fb.id !== 'env' && fb.id !== 'local_server' && (!limit.isRateLimit || limit.isDaily)) {
            setActiveApiKey(fb.id);
          }
          addToast(
            lang === 'bn'
              ? `পূর্বের কি-তে সমস্যা থাকায় স্বয়ংক্রিয়ভাবে "${fb.source}" কি ব্যবহার করা হয়েছে`
              : `Automatically switched to working key: ${fb.source}`,
            'info'
          );
          recoveredWithFallback = true;
          break;
        } catch (fbErr) {
          console.warn(`Fallback key ${fb.source} also failed:`, fbErr);
        }
      }

      if (!recoveredWithFallback) {
        throw err;
      }
    } else if (request?.config?.thinkingConfig) {
      // Safe fallback if a specific preview model rejected thinkingConfig
      try {
        const classicOptions = { ...request, config: { ...request.config } };
        delete classicOptions.config.thinkingConfig;
        response = await ai.models.generateContent(classicOptions);
      } catch (innerErr) {
        throw err;
      }
    } else {
      throw err;
    }
  } finally {
    // CRITICAL: Release the massive base64 audio data from memory immediately
    releaseRequestAudio(request);
  }

  return { response, ai, apiKey, source, keyLabel };
};

interface RetryOptions {
  ai: GoogleGenAI;
  apiKey: string;
  audio: AudioSource;
  modelName: string;
  inputFile: Blob;
  effectiveMimeType: string;
}

// Second attempt with a high-sensitivity prompt when the first answer had no text
export const retryHighSensitivity = async ({ ai, apiKey, audio, modelName, inputFile, effectiveMimeType }: RetryOptions) => {
  try {
    // If small file wasn't converted to WAV yet, convert and normalize gain now; otherwise reuse the same audio
    let audioPart = null;
    if (inputFile.size <= SMALL_FILE_LIMIT && effectiveMimeType !== 'audio/wav') {
      const wavRetry = await convertAudioToWav(inputFile, 16000);
      if (wavRetry?.wavBlob) {
        audioPart = { inlineData: { mimeType: 'audio/wav', data: await blobToBase64(wavRetry.wavBlob) } };
      }
    }
    const request = buildHighSensitivityRequest(modelName, audioPart || await audio.partFor(ai, apiKey));
    try {
      return await ai.models.generateContent(request);
    } finally {
      releaseRequestAudio(request);
    }
  } catch (retryErr) {
    console.warn("Adaptive retry failed:", retryErr);
    return null;
  }
};
