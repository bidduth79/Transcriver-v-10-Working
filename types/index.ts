export interface FileMeta {
  name: string;
  size: string;
  duration: string;
  type: string;
  date: string;
}

export interface TranscriptMeta {
  name: string;
  duration: string;
  channelName: string;
  date: string;
}

// A sign that a transcript may be wrong: Gemini's answer went round in a loop, little text for the audio's length,
// words end well before the audio does or go past its end, minutes in the middle with almost no text, or much
// less text than the recording's YouTube captions
export type TranscriptWarning = 'loop' | 'littleText' | 'endsEarly' | 'pastEnd' | 'gap' | 'lessThanCaptions';

export interface HistoryItem {
  id: string;
  fileName: string;
  duration: string;
  channelName: string;
  publishedDate: string;
  date: string;
  transcript: string;
  isFavorite?: boolean;
  bgbRemark?: string;
  summary?: string;
  title?: string;
  // Transcript field of records saved by old versions
  text?: string;
  extension?: string;
  size?: string;
  // How long the transcription took, e.g. "42s"
  timeTaken?: string;
  // The Gemini model that wrote the transcript (saved since November 2026)
  model?: string;
  // Signs that the transcript may be wrong, found when it was made (only on new transcripts)
  warnings?: TranscriptWarning[];
  hasBeenOpened?: boolean;
  // Other fields some features add (BGB analysis, sync flags, ...)
  [key: string]: unknown;
}

// A record as kept in IndexedDB and synced to the cloud: an id plus the fields of its store
export type StoredRecord = Record<string, unknown> & { id?: string | number };

export interface AudioData {
  id: string;
  base64?: string; 
  format?: string;
  data?: string;
}
