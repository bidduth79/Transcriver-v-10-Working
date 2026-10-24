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
