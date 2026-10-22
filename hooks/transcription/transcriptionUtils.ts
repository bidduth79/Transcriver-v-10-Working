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

export const calculateEstimatedSeconds = (audioDurationSeconds: number, inputFileSize: number) => {
    let estimated = 12;
    if (audioDurationSeconds > 0) {
        estimated = Math.max(8, Math.floor(6 + audioDurationSeconds * 0.06));
    } else {
        const sizeMB = inputFileSize / (1024 * 1024);
        estimated = Math.max(10, Math.floor(sizeMB * 3));
    }
    return estimated;
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

export { removeRepetitiveBlocks } from './textCleanup';
export { isFormatNativelySupportedByGemini, detectAudioMimeType } from './audioMimeDetection';
export { convertAudioToWav } from './wavConversion';
