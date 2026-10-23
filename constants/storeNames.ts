export const STORES = {
  HISTORY: 'studio_history',
  REPORTS: 'studio_reports',
  SEARCH_ANALYSIS: 'studio_analysis',
  API_KEYS: 'user_api_keys',
  MASTER_KEYS: 'system_master_keys',
  SYSTEM_ACTIVITY_LOGS: 'activity_logs',
  API_CALL_LOGS: 'gemini_call_logs',
  STATS: 'global_stats',
  CHAT_HISTORY: 'assistant_chat_history',
  YOUTUBE_CHANNELS: 'youtube_channels',
  YOUTUBE_API_KEYS: 'youtube_api_keys',
  YOUTUBE_QUEUE: 'youtube_queue',
  YOUTUBE_LINKS: 'youtube_links',
  TRANSCRIPTS: 'youtube_transcripts',
  YOUTUBE_AUDIO: 'youtube_audio'
};

// API keys are secrets: they stay on this device and are never copied to Firebase or Supabase
export const SECRET_STORES = [STORES.API_KEYS, STORES.MASTER_KEYS, STORES.YOUTUBE_API_KEYS];

export const FIREBASE_SYNCED_STORES = [
  STORES.HISTORY,
  STORES.REPORTS,
  STORES.SEARCH_ANALYSIS,
  STORES.STATS,
  STORES.CHAT_HISTORY,
  STORES.YOUTUBE_CHANNELS,
  STORES.YOUTUBE_QUEUE,
  STORES.YOUTUBE_LINKS,
  STORES.TRANSCRIPTS
];

export const ALL_STORES = Object.values(STORES);
