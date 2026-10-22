import { detectAudioMimeType } from '../transcription/transcriptionUtils';
import { FileMeta, HistoryItem } from '../../types';
import { isVideoFile, isOpusFile, formatDuration, readOpusDuration, watchMediaDuration, buildFileMeta } from './mediaDuration';

// New file: read duration (Opus via metadata, others via a hidden media element), sniff empty MIME types
export const loadNewFileMetadata = (file: File, url: string, onReady: (meta: FileMeta) => void) => {
  const isVideo = isVideoFile(file);

  const finishMetadata = async (durationStr: string) => {
    let detectedType = file.type;
    if (!detectedType) {
      try {
        const sniff = await detectAudioMimeType(file, file.name);
        detectedType = sniff.mimeType;
      } catch (e) {
        detectedType = isVideo ? 'video/mp4' : 'audio/mp3';
      }
    }
    onReady(buildFileMeta(file, durationStr, detectedType));
  };

  if (isOpusFile(file)) {
    readOpusDuration(file, 'estimate').then(finishMetadata);
    return;
  }

  const media = document.createElement(isVideo ? 'video' : 'audio');
  media.preload = 'metadata';
  media.src = url;
  watchMediaDuration(media, (duration) => {
    const valid = duration !== null && isFinite(duration) && !isNaN(duration) && duration > 0;
    finishMetadata(valid ? formatDuration(duration) : "Unknown");
  });
};

// File already transcribed: keep its saved duration as the fallback; MIME type is used as-is
export const loadHistoryFileMetadata = (
  file: File,
  url: string,
  existing: HistoryItem,
  setFileMeta: (meta: FileMeta) => void
) => {
  if (isOpusFile(file)) {
    readOpusDuration(file, 'unknown').then(duration => setFileMeta(buildFileMeta(file, duration, file.type)));
    return;
  }

  const audio = new Audio();
  audio.preload = 'metadata';
  watchMediaDuration(audio, (duration) => {
    const valid = duration !== null && isFinite(duration) && duration > 0;
    setFileMeta(buildFileMeta(file, valid ? formatDuration(duration) : (existing.duration || 'Unknown'), file.type));
  });
  audio.src = url;
};
