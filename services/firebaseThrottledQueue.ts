/**
 * Firebase Throttled Background Sync Queue (Batch-Aware Sync Lock & Zero-RAM Queue)
 * 
 * আধুনিক আর্কিটেকচার (Modern Batch-Aware Sync Lock):
 * ১. যতক্ষণ কোনো সিঙ্গেল ট্রান্সক্রিপশন বা ব্যাচ প্রসেসিং (Batch Processing) চলবে,
 *    ততক্ষণ ফায়ারবেইজ সিঙ্ক ১০০% পজ/লক (Paused) থাকবে—যাতে অডিও এনকোডিং ও নেটওয়ার্কের সাথে কখনোই সংঘর্ষ না হয়।
 * ২. কিউতে (queueMap) বিশাল ট্রান্সক্রিপ্ট টেক্সট মেমোরিতে ধরে না রেখে শুধুমাত্র ছোট ID স্ট্রিং রাখা হয় (Zero RAM Overhead)।
 * ৩. পুরো ব্যাচ বা ট্রান্সক্রিপশন সম্পূর্ণ শেষ হওয়ার ৮ সেকেন্ড পর, যখন ব্রাউজার ১০০% ফ্রি থাকে,
 *    তখন লোকাল IndexedDB থেকে ১টি করে ডাটা পড়ে ২.৫ সেকেন্ড বিরতি দিয়ে নিঃশব্দে ফায়ারবেইজে পাঠায়।
 */

import { db, authPromise, isFirebaseConfigured } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { FIREBASE_SYNCED_STORES, STORES } from '../constants/storeNames';

interface QueueItem {
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

const queueMap = new Map<string, QueueItem>();
const activeProcessingLocks = new Set<'transcription' | 'batch'>();
let isWorkerRunning = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hasRunStartupPull = false;
let isPullRunning = false;

export const isHeavyProcessingActive = (): boolean => activeProcessingLocks.size > 0;

/**
 * ট্রান্সক্রিপশন বা ব্যাচ প্রসেসিং শুরু/শেষ হলে এই লক কল করা হয়।
 * লক চালু থাকা অবস্থায় ফায়ারবেইজ কোনো নেটওয়ার্ক রিকোয়েস্ট বা স্ট্রিম চালাবে না।
 */
export const setHeavyProcessingActive = (source: 'transcription' | 'batch', active: boolean) => {
  if (active) {
    activeProcessingLocks.add(source);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
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
      syncStats.statusMessageBn = isFirebaseConfigured ? 'প্রস্তুত (Idle)' : 'ফায়ারবেইজ কনফিগার করা নেই';
      notifyListeners();
    }
  }
};

const syncStats: FirebaseGentleSyncStats = {
  isPulling: false,
  isPushing: false,
  isPausedForProcessing: false,
  pendingWrites: 0,
  lastPulledCount: 0,
  totalCloudHistoryDocs: 0,
  lastSyncTime: null,
  statusMessageBn: isFirebaseConfigured ? 'প্রস্তুত (Idle)' : 'ফায়ারবেইজ কনফিগার করা নেই'
};

const listeners = new Set<() => void>();
const notifyListeners = () => {
  syncStats.pendingWrites = queueMap.size;
  syncStats.isPushing = isWorkerRunning;
  syncStats.isPulling = isPullRunning;
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
  isPushing: isWorkerRunning,
  isPulling: isPullRunning,
  isPausedForProcessing: activeProcessingLocks.size > 0
});

// প্রতি ডকুমেন্টের মাঝে বিরতি (২.৫ সেকেন্ড) যাতে ব্রাউজারের থ্রেড সম্পূর্ণ রিল্যাক্সড থাকে
const THROTTLE_DELAY_MS = 2500;
// সাধারণ সেভের পর প্রথম রিকোয়েস্ট পাঠানোর আগে বিরতি (৪.৫ সেকেন্ড)
const INITIAL_IDLE_WAIT_MS = 4500;
// ট্রান্সক্রিপশন বা ব্যাচ শেষ হওয়ার পর কুল-ডাউন বিরতি (৮ সেকেন্ড)
const POST_PROCESSING_COOL_DOWN_MS = 8000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const enqueueFirebaseWrite = (storeName: string, id: string, _payload?: any) => {
  if (!isFirebaseConfigured || !db) return;

  const key = `${storeName}::${id}`;
  // মেমোরি বাঁচাতে সম্পূর্ণ ট্রান্সক্রিপ্ট অবজেক্ট র‍্যামে না রেখে শুধু ID রাখা হচ্ছে।
  // পাঠানোর সময় লোকাল IndexedDB থেকে পড়ে পাঠানো হবে।
  queueMap.set(key, {
    key,
    storeName,
    id: String(id),
    action: 'set'
  });

  notifyListeners();
  if (!isHeavyProcessingActive()) {
    scheduleWorker(INITIAL_IDLE_WAIT_MS);
  }
};

export const enqueueFirebaseDelete = (storeName: string, id: string) => {
  if (!isFirebaseConfigured || !db) return;

  const key = `${storeName}::${id}`;
  queueMap.set(key, {
    key,
    storeName,
    id: String(id),
    action: 'delete'
  });

  notifyListeners();
  if (!isHeavyProcessingActive()) {
    scheduleWorker(INITIAL_IDLE_WAIT_MS);
  }
};

const scheduleWorker = (delayMs = INITIAL_IDLE_WAIT_MS) => {
  if (isWorkerRunning || isHeavyProcessingActive()) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
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
  if (isWorkerRunning || queueMap.size === 0 || isHeavyProcessingActive()) return;
  isWorkerRunning = true;
  syncStats.statusMessageBn = 'ব্যাকগ্রাউন্ডে ধীরে ধীরে ফায়ারবেইজে সেভ হচ্ছে...';
  notifyListeners();

  try {
    await authPromise;
    if (!db) {
      isWorkerRunning = false;
      notifyListeners();
      return;
    }

    const { getFromStore } = await import('./db');

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
              await setDoc(doc(db, item.storeName, item.id), cleanPayload);
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
    isWorkerRunning = false;
    notifyListeners();

    if (queueMap.size > 0 && !isHeavyProcessingActive()) {
      scheduleWorker(INITIAL_IDLE_WAIT_MS);
    }
  }
};

/**
 * কোনোরকম চাপ বা ফ্রিজ ছাড়াই ফায়ারবেইজ থেকে নতুন ডাটা ছোট ছোট চ্যাংকে (Chunk) লোকাল IndexedDB-তে নিয়ে আসে।
 * এটি অ্যাপ ওপেন হওয়ার পর নিঃশব্দে একবার চলে, অথবা সেটিংস থেকে ম্যানুয়ালি চালানো যায়।
 */
export const scheduleGentleFirebasePull = (
  onHistoryUpdated?: () => void,
  forceManual = false
): Promise<{ pulledCount: number; cloudTotal: number }> => {
  if (!isFirebaseConfigured || !db) {
    syncStats.statusMessageBn = 'ফায়ারবেইজ কনফিগার করা নেই (.env)';
    notifyListeners();
    return Promise.resolve({ pulledCount: 0, cloudTotal: 0 });
  }

  if (isPullRunning || (!forceManual && isHeavyProcessingActive())) {
    return Promise.resolve({ pulledCount: syncStats.lastPulledCount, cloudTotal: syncStats.totalCloudHistoryDocs });
  }

  if (!forceManual && hasRunStartupPull) {
    return Promise.resolve({ pulledCount: syncStats.lastPulledCount, cloudTotal: syncStats.totalCloudHistoryDocs });
  }

  hasRunStartupPull = true;

  return new Promise((resolve) => {
    const startDelay = forceManual ? 100 : 4000; // স্টার্টআপে ৪ সেকেন্ড অপেক্ষা করবে যাতে UI সম্পূর্ণ ফ্রি থাকে

    setTimeout(async () => {
      if (isPullRunning || (!forceManual && isHeavyProcessingActive())) {
        resolve({ pulledCount: 0, cloudTotal: 0 });
        return;
      }
      isPullRunning = true;
      syncStats.statusMessageBn = 'ফায়ারবেইজ থেকে ধীরে ধীরে ডাটা চেক করা হচ্ছে...';
      notifyListeners();

      let totalNewItemsMerged = 0;
      let cloudHistoryTotal = 0;

      try {
        await authPromise;
        if (!db) {
          isPullRunning = false;
          notifyListeners();
          resolve({ pulledCount: 0, cloudTotal: 0 });
          return;
        }

        const { initDB } = await import('./db');
        const idb = await initDB();

        for (const storeName of FIREBASE_SYNCED_STORES) {
          if (!navigator.onLine || (!forceManual && isHeavyProcessingActive())) break;

          try {
            const snap = await getDocs(collection(db, storeName));
            if (storeName === STORES.HISTORY) {
              cloudHistoryTotal = snap.size;
              syncStats.totalCloudHistoryDocs = cloudHistoryTotal;
              notifyListeners();
            }

            if (snap.empty) {
              await sleep(600);
              continue;
            }

            // লোকাল ডাটাবেজে আগে থেকে কোন কোন ID আছে তা হালকাভাবে চেক করুন
            const existingKeys = await new Promise<Set<string>>((res) => {
              try {
                const tx = idb.transaction([storeName], 'readonly');
                const st = tx.objectStore(storeName);
                const req = st.getAllKeys();
                req.onsuccess = () => {
                  res(new Set((req.result || []).map(k => String(k))));
                };
                req.onerror = () => res(new Set());
              } catch (e) {
                res(new Set());
              }
            });

            // শুধুমাত্র যে ডকুমেন্টগুলো লোকালে নেই সেগুলো আলাদা করুন (যাতে অযথা ডুপ্লিকেট রাইট না হয়)
            const missingDocs: any[] = [];
            snap.forEach((docSnap) => {
              const docId = String(docSnap.id);
              if (!existingKeys.has(docId)) {
                missingDocs.push({ id: docId, ...docSnap.data() });
              }
            });

            if (missingDocs.length > 0) {
              syncStats.statusMessageBn = `${storeName} থেকে ${missingDocs.length}টি নতুন ডাটা ধীরে ধীরে যুক্ত হচ্ছে...`;
              notifyListeners();

              // ১০টি করে ছোট ব্যাচে সেভ করুন এবং প্রতি ব্যাচের মাঝে ২৫০ms বিরতি দিন (Zero UI Pressure)
              const CHUNK_SIZE = 10;
              for (let i = 0; i < missingDocs.length; i += CHUNK_SIZE) {
                const chunk = missingDocs.slice(i, i + CHUNK_SIZE);
                await new Promise<void>((res) => {
                  try {
                    const tx = idb.transaction([storeName], 'readwrite');
                    const st = tx.objectStore(storeName);
                    chunk.forEach(item => st.put(item));
                    tx.oncomplete = () => res();
                    tx.onerror = () => res();
                  } catch (e) {
                    res();
                  }
                });
                totalNewItemsMerged += chunk.length;
                syncStats.lastPulledCount = totalNewItemsMerged;
                notifyListeners();
                await sleep(250);
              }

              if (storeName === STORES.HISTORY && onHistoryUpdated) {
                onHistoryUpdated();
              }
            }
          } catch (storeErr: any) {
            console.warn(`[Firebase Gentle Pull] Notice on ${storeName}:`, storeErr?.message || storeErr);
          }

          // পরবর্তী স্টোর চেক করার আগে ১.২ সেকেন্ড বিরতি নিন
          await sleep(1200);
        }

        syncStats.lastSyncTime = new Date().toLocaleTimeString('bn-BD');
        syncStats.statusMessageBn = totalNewItemsMerged > 0
          ? `ফায়ারবেইজ থেকে ${totalNewItemsMerged}টি নতুন ডাটা সফলভাবে যুক্ত হয়েছে (মোট ক্লাউড হিস্টোরি: ${cloudHistoryTotal}টি)`
          : `ফায়ারবেইজের সকল ডাটা (${cloudHistoryTotal}টি হিস্টোরি) লোকালে আপ-টু-ডেট আছে`;
      } catch (err: any) {
        console.warn("[Firebase Gentle Pull] Error:", err?.message || err);
        syncStats.statusMessageBn = 'ফায়ারবেইজ কানেকশন সাময়িকভাবে পাওয়া যায়নি';
      } finally {
        isPullRunning = false;
        notifyListeners();
        resolve({ pulledCount: totalNewItemsMerged, cloudTotal: cloudHistoryTotal });
      }
    }, startDelay);
  });
};

