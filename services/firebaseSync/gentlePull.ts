import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { FIREBASE_SYNCED_STORES, STORES } from '../../constants/storeNames';
import { runtime, syncStats, notifyListeners, isHeavyProcessingActive, sleep } from './syncState';

// লোকাল ডাটাবেজে আগে থেকে কোন কোন ID আছে তা হালকাভাবে চেক করুন
const getLocalKeys = (idb: IDBDatabase, storeName: string) => new Promise<Set<string>>((res) => {
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

const putChunk = (idb: IDBDatabase, storeName: string, chunk: any[]) => new Promise<void>((res) => {
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

  if (runtime.isPullRunning || (!forceManual && isHeavyProcessingActive())) {
    return Promise.resolve({ pulledCount: syncStats.lastPulledCount, cloudTotal: syncStats.totalCloudHistoryDocs });
  }

  if (!forceManual && runtime.hasRunStartupPull) {
    return Promise.resolve({ pulledCount: syncStats.lastPulledCount, cloudTotal: syncStats.totalCloudHistoryDocs });
  }

  runtime.hasRunStartupPull = true;

  return new Promise((resolve) => {
    const startDelay = forceManual ? 100 : 4000; // স্টার্টআপে ৪ সেকেন্ড অপেক্ষা করবে যাতে UI সম্পূর্ণ ফ্রি থাকে

    setTimeout(async () => {
      if (runtime.isPullRunning || (!forceManual && isHeavyProcessingActive())) {
        resolve({ pulledCount: 0, cloudTotal: 0 });
        return;
      }
      runtime.isPullRunning = true;
      syncStats.statusMessageBn = 'ফায়ারবেইজ থেকে ধীরে ধীরে ডাটা চেক করা হচ্ছে...';
      notifyListeners();

      let totalNewItemsMerged = 0;
      let cloudHistoryTotal = 0;

      try {
        await authPromise;
        if (!db) {
          runtime.isPullRunning = false;
          notifyListeners();
          resolve({ pulledCount: 0, cloudTotal: 0 });
          return;
        }

        const { initDB } = await import('../db');
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

            const existingKeys = await getLocalKeys(idb, storeName);

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
                await putChunk(idb, storeName, chunk);
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
        runtime.isPullRunning = false;
        notifyListeners();
        resolve({ pulledCount: totalNewItemsMerged, cloudTotal: cloudHistoryTotal });
      }
    }, startDelay);
  });
};
