import { GoogleGenAI } from "@google/genai";
import { getFallbackProviders, setActiveApiKey } from '../../services/ApiKeyManager';
import { detectAudioMimeType, convertAudioToWav, blobToBase64 } from './transcriptionUtils';
import { isKeyOrProjectBlockedError } from './transcriptionErrors';
import { buildHighSensitivityRequest, releaseRequestAudio } from './geminiRequest';

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

interface RecoveryOptions {
  provider: { key: string; source: string };
  request: any;
  lang: Lang;
  setStage: (stage: string) => void;
  addToast: Toast;
}

// Calls Gemini; on blocked/quota errors tries fallback keys, and drops thinkingConfig if a model rejects it.
export const generateWithRecovery = async ({ provider, request, lang, setStage, addToast }: RecoveryOptions) => {
  let ai = new GoogleGenAI({ apiKey: provider.key });
  let source = provider.source;
  let keyLabel = keyLabelOf(provider.source, provider.key);
  let response: any = null;

  try {
    response = await ai.models.generateContent(request);
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
          const fbAi = new GoogleGenAI({ apiKey: fb.key });
          response = await fbAi.models.generateContent(request);
          ai = fbAi;
          source = fb.source;
          keyLabel = keyLabelOf(fb.source, fb.key);
          if (fb.id && fb.id !== 'env' && fb.id !== 'local_server') {
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
    } else if (request.config?.thinkingConfig) {
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

  return { response, ai, source, keyLabel };
};

interface RetryOptions {
  ai: GoogleGenAI;
  modelName: string;
  inputFile: Blob;
  effectiveFile: Blob;
  effectiveMimeType: string;
}

// Second attempt with a high-sensitivity prompt when the first answer had no text
export const retryHighSensitivity = async ({ ai, modelName, inputFile, effectiveFile, effectiveMimeType }: RetryOptions) => {
  try {
    let retryBlob = effectiveFile;
    let retryMime = effectiveMimeType;
    // If small file wasn't converted to WAV yet, convert and normalize gain now
    if (inputFile.size <= SMALL_FILE_LIMIT && retryMime !== 'audio/wav') {
      const wavRetry = await convertAudioToWav(inputFile, 16000);
      if (wavRetry?.wavBlob) {
        retryBlob = wavRetry.wavBlob;
        retryMime = 'audio/wav';
      }
    }
    const request = buildHighSensitivityRequest(modelName, retryMime, await blobToBase64(retryBlob));
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
