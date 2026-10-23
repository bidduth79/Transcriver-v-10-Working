import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  queueMap, activeProcessingLocks, runtime, syncStats, notifyListeners, isHeavyProcessingActive,
  sleep, IDLE_MESSAGE, THROTTLE_DELAY_MS, INITIAL_IDLE_WAIT_MS, POST_PROCESSING_COOL_DOWN_MS,
} from './syncState';
import { withSyncStamp } from './syncStamp';
import { packForCloud } from './transcriptCompression';

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
      ? `ব্যাচ প্রসেসিং চলছে — ফায়ারবেইজ সিঙ্ক সাময়িক বিরতিতে আছে (অপেক্ষমাণ: ${queueMap.size}টি)`
      : `ট্রান্সক্রিপশন চলছে — ফায়ারবেইজ সিঙ্ক সাময়িক বিরতিতে আছে`;
    notifyListeners();
  } else {
    activeProcessingLocks.delete(source);
    notifyListeners();
    if (activeProcessingLocks.size === 0 && queueMap.size > 0) {
      syncStats.statusMessageBn = `কাজ সম্পন্ন — ৮ সেকেন্ড পর ধীরে ধীরে ${queueMap.size}টি ডাটা ফায়ারবেইজে সিঙ্ক হবে...`;
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

export const enqueueFirebaseWrite = (storeName: string, id: string, _payload?: any) => enqueue(storeName, id, 'set');

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

const sanitizeForFirestore = (obj: any): Record<string, any> => {
  const clean: Record<string, any> = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (obj[k] !== undefined) {
        clean[k] = obj[k];
      }
    }
  }
  return clean;
};

const startWorker = async () => {
  if (runtime.isWorkerRunning || queueMap.size === 0 || isHeavyProcessingActive()) return;
  runtime.isWorkerRunning = true;
  syncStats.statusMessageBn = 'ব্যাকগ্রাউন্ডে ধীরে ধীরে ফায়ারবেইজে সেভ হচ্ছে...';
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
        syncStats.statusMessageBn = `প্রসেসিং শুরু হওয়ায় ফায়ারবেইজ সিঙ্ক পজ করা হয়েছে (বাকি: ${queueMap.size}টি)`;
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
            let localRecord: any = await getFromStore(item.storeName, item.id);
            if (localRecord) {
              const cleanPayload = sanitizeForFirestore(localRecord);
              localRecord = null; // Free reference immediately
              await setDoc(doc(db, item.storeName, item.id), withSyncStamp(await packForCloud(item.storeName, cleanPayload)));
              console.debug(`[Firebase Gentle Sync] Sent document ${item.storeName}/${item.id}`);
            }
          } else if (item.action === 'delete') {
            await deleteDoc(doc(db, item.storeName, item.id));
            console.debug(`[Firebase Gentle Sync] Deleted document ${item.storeName}/${item.id}`);
          }
          syncStats.lastSyncTime = new Date().toLocaleTimeString('bn-BD');
        } catch (itemErr: any) {
          console.warn(`[Firebase Gentle Sync] Handled non-fatal sync notice for ${item.storeName}:`, itemErr?.message || itemErr);
        }
      }

      // পরবর্তী আইটেম পাঠানোর আগে ২.৫ সেকেন্ড বিরতি নিন (Gentle Throttle)
      await sleep(THROTTLE_DELAY_MS);
    }

    if (!isHeavyProcessingActive() && queueMap.size === 0) {
      syncStats.statusMessageBn = 'ফায়ারবেইজ সিঙ্ক সম্পূর্ণ আপ-টু-ডেট আছে';
    }
  } catch (err: any) {
    console.warn("[Firebase Gentle Sync] Worker notice:", err?.message || err);
  } finally {
    runtime.isWorkerRunning = false;
    notifyListeners();

    if (queueMap.size > 0 && !isHeavyProcessingActive()) {
      scheduleWorker(INITIAL_IDLE_WAIT_MS);
    }
  }
};
