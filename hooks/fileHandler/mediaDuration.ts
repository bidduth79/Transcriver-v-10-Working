const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.aac', '.opus', '.flac'];

export const isSupportedMediaFile = (file: File) => {
  const name = file.name.toLowerCase();
  return file.type.startsWith('audio/') || file.type.startsWith('video/') || SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
};

export const isVideoFile = (file: File) => {
  const name = file.name.toLowerCase();
  return file.type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.mov') || name.endsWith('.avi');
};

export const isOpusFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith('.opus') || name.endsWith('.ogg') || file.type === 'audio/opus' || file.type.includes('ogg') || file.type.includes('opus');
};

// "M:SS"
export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Opus speech averages ~32kbps (4000 bytes/sec); used when the stream has no duration header
export const estimateOpusDuration = (fileSize: number) => formatDuration(Math.max(10, Math.round(fileSize / 4000)));

// Reads Opus/Ogg duration from container metadata; `onParseError` decides the fallback text
export const readOpusDuration = async (file: File, onParseError: 'estimate' | 'unknown') => {
  try {
    // Loaded on demand so the ~340 KB parser is not part of app startup
    const musicMetadata = await import('music-metadata');
    const metadata = await musicMetadata.parseBlob(file);
    if (metadata && metadata.format && metadata.format.duration) {
      return formatDuration(metadata.format.duration);
    }
    return estimateOpusDuration(file.size);
  } catch (err) {
    if (onParseError === 'unknown') return 'Unknown';
    console.warn("Metadata parsing failed:", err);
    return estimateOpusDuration(file.size);
  }
};

/**
 * Waits for an audio/video element's metadata (max 3s). Calls `onResult` exactly once with the
 * duration, or null on error/timeout, after releasing the element.
 */
export const watchMediaDuration = (media: HTMLMediaElement, onResult: (duration: number | null) => void) => {
  let resolved = false;
  const cleanupMedia = () => {
    try {
      media.onloadedmetadata = null;
      media.onerror = null;
      media.src = '';
      media.load();
    } catch {}
  };
  const finish = (duration: number | null) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeoutId);
    cleanupMedia();
    onResult(duration);
  };

  const timeoutId = window.setTimeout(() => finish(null), 3000);
  media.onloadedmetadata = () => finish(media.duration);
  media.onerror = () => finish(null);
};

export const buildFileMeta = (file: File, duration: string, type: string) => ({
  name: file.name,
  size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
  duration,
  type,
  date: new Date().toISOString()
});
