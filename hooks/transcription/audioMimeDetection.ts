export const isFormatNativelySupportedByGemini = (mimeType: string): boolean => {
  if (!mimeType) return false;
  const lower = mimeType.toLowerCase();
  const supported = [
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/m4a',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/flac'
  ];
  return supported.some(s => lower.startsWith(s));
};

export interface AudioSniffResult {
  mimeType: string;
  isOggOpus: boolean;
  isWhatsApp: boolean;
}

/**
 * Sniffs the real MIME type from file header magic bytes, extension, and common app patterns (e.g. WhatsApp).
 */
export const detectAudioMimeType = async (file: Blob, fileName: string = ''): Promise<AudioSniffResult> => {
  let isOggOpus = false;
  let isWhatsApp = false;
  const lowerName = fileName.toLowerCase();

  if (
    lowerName.includes('whatsapp') || 
    lowerName.includes('ptt-') || 
    lowerName.includes('audio 202') ||
    lowerName.includes('voice')
  ) {
    isWhatsApp = true;
  }

  try {
    const slice = file.slice(0, 64);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Ogg container: "OggS" (0x4F, 0x67, 0x67, 0x53) - used by WhatsApp Opus voice notes
    if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      isOggOpus = true;
      return { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp };
    }

    // MP3 with ID3: "ID3" (0x49, 0x44, 0x33)
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp };
    }

    // MP3 without ID3 header: MPEG frame sync (0xFF followed by 0xFB, 0xF3, 0xF2)
    if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
      return { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp };
    }

    // RIFF WAV: "RIFF" .... "WAVE"
    if (
      bytes.length >= 12 && 
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
    ) {
      return { mimeType: 'audio/wav', isOggOpus: false, isWhatsApp };
    }

    // MP4 / M4A: "ftyp" at offset 4
    if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      if (lowerName.endsWith('.mp4') || lowerName.endsWith('.mkv') || lowerName.endsWith('.mov') || lowerName.endsWith('.avi') || (file.type && file.type.startsWith('video/'))) {
        return { mimeType: 'video/mp4', isOggOpus: false, isWhatsApp: false };
      }
      return { mimeType: 'audio/mp4', isOggOpus: false, isWhatsApp: false };
    }

    // WebM / Matroska: 0x1A, 0x45, 0xDF, 0xA3
    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      const isVideo = lowerName.endsWith('.webm') && (file.type?.startsWith('video/') || !lowerName.includes('audio'));
      return { mimeType: isVideo ? 'video/webm' : 'audio/webm', isOggOpus: false, isWhatsApp: false };
    }

    // FLAC: "fLaC" (0x66, 0x4C, 0x61, 0x43)
    if (bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return { mimeType: 'audio/flac', isOggOpus: false, isWhatsApp: false };
    }

    // AAC (ADTS frame sync: 0xFFF)
    if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)) {
      return { mimeType: 'audio/aac', isOggOpus: false, isWhatsApp: false };
    }
  } catch (e) {
    console.warn("MIME sniffing failed:", e);
  }

  // Fallback to filename extensions
  if (lowerName.endsWith('.opus')) return { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: false };
  if (lowerName.endsWith('.ogg')) return { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: false };
  if (lowerName.endsWith('.m4a')) return { mimeType: 'audio/mp4', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.mp4')) return { mimeType: 'video/mp4', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.mov')) return { mimeType: 'video/quicktime', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.mkv')) return { mimeType: 'video/x-matroska', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.avi')) return { mimeType: 'video/x-msvideo', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.aac')) return { mimeType: 'audio/aac', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.wav')) return { mimeType: 'audio/wav', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.mp3')) return { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.flac')) return { mimeType: 'audio/flac', isOggOpus: false, isWhatsApp: false };
  if (lowerName.endsWith('.webm')) {
    const isVideo = file.type?.startsWith('video/') || lowerName.includes('video');
    return { mimeType: isVideo ? 'video/webm' : 'audio/webm', isOggOpus: false, isWhatsApp: false };
  }

  // Fallback to file.type if provided and not generic
  if (file.type && file.type !== 'application/octet-stream') {
    const isOpus = file.type.includes('ogg') || file.type.includes('opus');
    return { mimeType: file.type, isOggOpus: isOpus, isWhatsApp };
  }

  // If filename indicates WhatsApp voice note without extension, it is Ogg Opus
  if (isWhatsApp) {
    return { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: true };
  }

  return { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: false };
};
