import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  queueMap, activeProcessingLocks, runtime, syncStats, notifyListeners, isHeavyProcessingActive,
  sleep, IDLE_MESSAGE, THROTTLE_DELAY_MS, INITIAL_IDLE_WAIT_MS, POST_PROCESSING_COOL_DOWN_MS,
} from './syncState';
import { withSyncStamp } from './syncStamp';
import { packForCloud } from './transcriptCompression';
import { tombstoneFor } from './tombstone';
import { messageOf } from '../../utils/errorMessage';
import { uiText } from '../../utils/uiText';
import { currentAppLang } from '../../hooks/useThemeStore';

/**
 * ট্রান্সক্রিপশন বা ব্যাচ প্রসেসিং শুরু/শেষ হলে এই লক কল করা হয়।
 * লক চালু থাকা অবস্থায় ফায়ারবেইজ কোনো নেটওয়ার্ক রিকোয়েস্ট বা স্ট্রিম চালাবে না।
 */
export const setHeavyProcessingActive = (source: 'transcription' | 'batch', active: boolean) => {
  if (active) {
    activeProcessingLocks.add(source);
    if (runtime.debounceTimer) {
      clearTimeout(runtime.debounceTimer);
      runtime.debounceTimer = null;
    }
    syncStats.statusMessageBn = source === 'batch'
      ? uiText(currentAppLang(), 'syncPausedBatch', { count: queueMap.size })
      : uiText(currentAppLang(), 'syncPausedTranscription');
    notifyListeners();
  } else {
    activeProcessingLocks.delete(source);
    notifyListeners();
    if (activeProcessingLocks.size === 0 && queueMap.size > 0) {
      syncStats.statusMessageBn = uiText(currentAppLang(), 'syncResumesSoon', { count: queueMap.size });
      notifyListeners();
      scheduleWorker(POST_PROCESSING_COOL_DOWN_MS);
    } else if (activeProcessingLocks.size === 0) {
      syncStats.statusMessageBn = IDLE_MESSAGE;
      notifyListeners();
    }
  }
};

// মেমোরি বাঁচাতে সম্পূর্ণ ট্রান্সক্রিপ্ট অবজেক্ট র‍্যামে না রেখে শুধু ID রাখা হচ্ছে।
// পাঠানোর সময় লোকাল IndexedDB থেকে পড়ে পাঠানো হবে।
const enqueue = (storeName: string, id: string, action: 'set' | 'delete') => {
  if (!isFirebaseConfigured || !db) return;

  const key = `${storeName}::${id}`;
  queueMap.set(key, { key, storeName, id: String(id), action });

  notifyListeners();
  if (!isHeavyProcessingActive()) {
    scheduleWorker(INITIAL_IDLE_WAIT_MS);
  }
};

export const enqueueFirebaseWrite = (storeName: string, id: string, _payload?: unknown) => enqueue(storeName, id, 'set');

export const enqueueFirebaseDelete = (storeName: string, id: string) => enqueue(storeName, id, 'delete');

const scheduleWorker = (delayMs = INITIAL_IDLE_WAIT_MS) => {
  if (runtime.isWorkerRunning || isHeavyProcessingActive()) return;

  if (runtime.debounceTimer) {
    clearTimeout(runtime.debounceTimer);
  }

  runtime.debounceTimer = setTimeout(() => {
    runtime.debounceTimer = null;
    if (!isHeavyProcessingActive()) {
      startWorker();
    }
  }, delayMs);
};

const sanitizeForFirestore = (obj: unknown): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    for (const k of Object.keys(record)) {
      if (record[k] !== undefined) {
        clean[k] = record[k];
      }
    }
  }
  return clean;
};

const startWorker = async () => {
  if (runtime.isWorkerRunning || queueMap.size === 0 || isHeavyProcessingActive()) return;
  runtime.isWorkerRunning = true;
  syncStats.statusMessageBn = uiText(currentAppLang(), 'syncSavingInBackground');
  notifyListeners();

  try {
    await authPromise;
    if (!db) {
      runtime.isWorkerRunning = false;
      notifyListeners();
      return;
    }

    const { getFromStore } = await import('../db');

    while (queueMap.size > 0) {
      // যদি এর মধ্যে নতুন ট্রান্সক্রিপশন বা ব্যাচ শুরু হয়, সাথে সাথে সিঙ্ক পজ করে বেরিয়ে আসুন!
      if (isHeavyProcessingActive()) {
        syncStats.statusMessageBn = uiText(currentAppLang(), 'syncPausedProcessing', { count: queueMap.size });
        break;
      }

      if (!navigator.onLine) {
        await sleep(5000);
        continue;
      }

      const nextKey = queueMap.keys().next().value;
      if (!nextKey) break;

      const item = queueMap.get(nextKey);
      queueMap.delete(nextKey);
      notifyListeners();

      if (item) {
        try {
          if (item.action === 'set') {
            // লোকাল IndexedDB থেকে ঠিক পাঠানোর মুহূর্তে ডাটাটি পড়ুন এবং পাঠানোর সাথে সাথে মেমোরি মুক্ত করুন
            let localRecord: unknown = await getFromStore(item.storeName, item.id);
            if (localRecord) {
              const cleanPayload = sanitizeForFirestore(localRecord);
              localRecord = null; // Free reference immediately
              await setDoc(doc(db, item.storeName, item.id), withSyncStamp(await packForCloud(item.storeName, cleanPayload)));
              console.debug(`[Firebase Gentle Sync] Sent document ${item.storeName}/${item.id}`);
            }
          } else if (item.action === 'delete') {
            await setDoc(doc(db, item.storeName, item.id), tombstoneFor(item.id));
            console.debug(`[Firebase Gentle Sync] Deleted document ${item.storeName}/${item.id}`);
          }
          syncStats.lastSyncTime = new Date().toLocaleTimeString('bn-BD');
        } catch (itemErr) {
          console.warn(`[Firebase Gentle Sync] Handled non-fatal sync notice for ${item.storeName}:`, messageOf(itemErr) || itemErr);
        }
      }

      // পরবর্তী আইটেম পাঠানোর আগে ২.৫ সেকেন্ড বিরতি নিন (Gentle Throttle)
      await sleep(THROTTLE_DELAY_MS);
    }

    if (!isHeavyProcessingActive() && queueMap.size === 0) {
      syncStats.statusMessageBn = uiText(currentAppLang(), 'syncUpToDate');
    }
  } catch (err) {
    console.warn("[Firebase Gentle Sync] Worker notice:", messageOf(err) || err);
  } finally {
    runtime.isWorkerRunning = false;
    notifyListeners();

    if (queueMap.size > 0 && !isHeavyProcessingActive()) {
      scheduleWorker(INITIAL_IDLE_WAIT_MS);
    }
  }
};
