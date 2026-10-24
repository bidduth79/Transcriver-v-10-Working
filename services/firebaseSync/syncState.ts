import { isFirebaseConfigured } from '../firebase';
import { uiText } from '../../utils/uiText';
import { currentAppLang } from '../../hooks/useThemeStore';

export interface QueueItem {
  key: string;
  storeName: string;
  id: string;
  action: 'set' | 'delete';
}

export interface FirebaseGentleSyncStats {
  isPulling: boolean;
  isPushing: boolean;
  isPausedForProcessing: boolean;
  pendingWrites: number;
  lastPulledCount: number;
  totalCloudHistoryDocs: number;
  lastSyncTime: string | null;
  statusMessageBn: string;
}

// প্রতি ডকুমেন্টের মাঝে বিরতি (২.৫ সেকেন্ড) যাতে ব্রাউজারের থ্রেড সম্পূর্ণ রিল্যাক্সড থাকে
export const THROTTLE_DELAY_MS = 2500;
// সাধারণ সেভের পর প্রথম রিকোয়েস্ট পাঠানোর আগে বিরতি (৪.৫ সেকেন্ড)
export const INITIAL_IDLE_WAIT_MS = 4500;
// ট্রান্সক্রিপশন বা ব্যাচ শেষ হওয়ার পর কুল-ডাউন বিরতি (৮ সেকেন্ড)
export const POST_PROCESSING_COOL_DOWN_MS = 8000;

export const IDLE_MESSAGE = isFirebaseConfigured ? uiText(currentAppLang(), 'idleReady') : uiText(currentAppLang(), 'firebaseNotConfigured');

export const queueMap = new Map<string, QueueItem>();
export const activeProcessingLocks = new Set<'transcription' | 'batch'>();

// Mutable flags shared by the push worker and the pull job
export const runtime = {
  isWorkerRunning: false,
  debounceTimer: null as ReturnType<typeof setTimeout> | null,
  hasRunStartupPull: false,
  isPullRunning: false,
};

export const syncStats: FirebaseGentleSyncStats = {
  isPulling: false,
  isPushing: false,
  isPausedForProcessing: false,
  pendingWrites: 0,
  lastPulledCount: 0,
  totalCloudHistoryDocs: 0,
  lastSyncTime: null,
  statusMessageBn: IDLE_MESSAGE
};

export const isHeavyProcessingActive = (): boolean => activeProcessingLocks.size > 0;

const listeners = new Set<() => void>();
export const notifyListeners = () => {
  syncStats.pendingWrites = queueMap.size;
  syncStats.isPushing = runtime.isWorkerRunning;
  syncStats.isPulling = runtime.isPullRunning;
  syncStats.isPausedForProcessing = activeProcessingLocks.size > 0;
  listeners.forEach(fn => {
    try { fn(); } catch (e) {}
  });
};

export const subscribeFirebaseSyncStats = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getFirebaseSyncStats = (): FirebaseGentleSyncStats => ({
  ...syncStats,
  pendingWrites: queueMap.size,
  isPushing: runtime.isWorkerRunning,
  isPulling: runtime.isPullRunning,
  isPausedForProcessing: activeProcessingLocks.size > 0
});

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
