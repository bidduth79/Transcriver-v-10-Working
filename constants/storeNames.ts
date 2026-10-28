export const STORES = {
  HISTORY: 'studio_history',
  REPORTS: 'studio_reports',
  SEARCH_ANALYSIS: 'studio_analysis',
  API_KEYS: 'user_api_keys',
  SYSTEM_ACTIVITY_LOGS: 'activity_logs',
  // Audio saved with history items (the name is from an older YouTube feature)
  YOUTUBE_AUDIO: 'youtube_audio'
};

// API keys are secrets: they stay on this device and are never copied to Firebase.
// Older versions also synced the (now unused) master and YouTube key stores, so their cloud copies are removed too.
export const SECRET_STORES = [STORES.API_KEYS, 'system_master_keys', 'youtube_api_keys'];

export const FIREBASE_SYNCED_STORES = [
  STORES.HISTORY,
  STORES.REPORTS,
  STORES.SEARCH_ANALYSIS,
];

export const ALL_STORES = Object.values(STORES);
