export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    let reader: FileReader | null = new FileReader();
    reader.onloadend = () => {
      if (!reader) {
        reject(new Error("Reader was null"));
        return;
      }
      const result = reader.result as string;
      if (!result) {
        reject(new Error("Failed to convert audio blob to base64"));
        reader = null;
        return;
      }
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      
      // Aggressive cleanup
      reader.onloadend = null;
      reader.onerror = null;
      reader = null;
      
      resolve(base64);
    };
    reader.onerror = (e) => {
      if (reader) {
        reader.onloadend = null;
        reader.onerror = null;
        reader = null;
      }
      reject(e);
    };
    reader.readAsDataURL(blob);
  });
};

// Seconds of work per second of audio when there is nothing to learn from yet: measured on 16 to 47 minute
// talk shows, Gemini took 8 to 15% of their length
export const DEFAULT_SECONDS_PER_AUDIO_SECOND = 0.12;
// Upload, preparation and the answer's first words take time even for a short clip
const FIXED_SECONDS = 15;

// The speed of earlier transcriptions (median of the last 20 with a known length and time), or the default
export const learnedSecondsPerAudioSecond = (history: { duration?: string; timeTaken?: string | number }[]) => {
    const rates = history
        .map(item => ({ audio: parseDurationToSeconds(item.duration), took: parseFloat(String(item.timeTaken ?? '')) }))
        .filter(({ audio, took }) => audio >= 60 && took > 0)
        .slice(0, 20)
        .map(({ audio, took }) => Math.max(0, took - FIXED_SECONDS) / audio)
        .sort((x, y) => x - y);
    return rates.length < 3 ? DEFAULT_SECONDS_PER_AUDIO_SECOND : rates[Math.floor(rates.length / 2)];
};

export const calculateEstimatedSeconds = (audioDurationSeconds: number, inputFileSize: number, secondsPerAudioSecond = DEFAULT_SECONDS_PER_AUDIO_SECOND) => {
    if (audioDurationSeconds > 0) return Math.round(FIXED_SECONDS + audioDurationSeconds * secondsPerAudioSecond);
    // Length unknown: about a minute of speech per 0.5 MB of compressed audio
    const sizeMB = inputFileSize / (1024 * 1024);
    return Math.round(FIXED_SECONDS + sizeMB * 120 * secondsPerAudioSecond);
};

export const parseDurationToSeconds = (durationStr: string | undefined): number => {
    let audioDurationSeconds = 0;
    if (durationStr && typeof durationStr === 'string') {
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) {
            audioDurationSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            audioDurationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }
    return audioDurationSeconds;
};

export { removeRepetitiveBlocks, splitLongParagraphs } from './textCleanup';
export { isFormatNativelySupportedByGemini, detectAudioMimeType } from './audioMimeDetection';
export { convertAudioToWav } from './wavConversion';
