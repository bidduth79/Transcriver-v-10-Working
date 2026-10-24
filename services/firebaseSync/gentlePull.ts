import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { FIREBASE_SYNCED_STORES, STORES } from '../../constants/storeNames';
import { runtime, syncStats, notifyListeners, isHeavyProcessingActive, sleep } from './syncState';
import { pullStoreInPages } from './pullStorePages';
import { removeCloudSecretCopies } from './secretCleanup';
import { SYNC_STAMP_FIELD } from './syncStamp';
import { startOfYesterday, getPullCheckpoint, savePullCheckpoint, countCloudDocs } from './pullWindow';

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
        const cloudDb = db;
        try {
          const removed = await removeCloudSecretCopies(cloudDb, idb);
          if (removed) console.debug(`[Firebase Gentle Pull] Removed ${removed} API key copies from the cloud`);
        } catch (cleanupErr: any) {
          console.warn('[Firebase Gentle Pull] API key cleanup notice:', cleanupErr?.message || cleanupErr);
        }
        const pullStartedAt = Date.now();
        const shouldStop = () => !navigator.onLine || (!forceManual && isHeavyProcessingActive());

        for (const storeName of FIREBASE_SYNCED_STORES) {
          if (shouldStop()) break;

          try {
            const isHistory = storeName === STORES.HISTORY;
            // A manual sync reads every history document, so it also re-sends long ones in compressed form
            const repair = isHistory && forceManual ? (await import('./cloudRepair')).createHistoryRepair() : null;
            const pull = (since?: { field: string; min: string | Date }) => pullStoreInPages({
              db: cloudDb, idb, storeName, shouldStop, since, onCloudDoc: repair?.onCloudDoc,
              onCloudCount: (count) => {
                if (!isHistory || !forceManual) return;
                cloudHistoryTotal = count;
                syncStats.totalCloudHistoryDocs = cloudHistoryTotal;
                notifyListeners();
              },
              onMerged: (count) => {
                totalNewItemsMerged += count;
                syncStats.lastPulledCount = totalNewItemsMerged;
                notifyListeners();
              },
              onRemoved: (count) => {
                if (count > 0) console.debug(`[Firebase Gentle Pull] Removed ${count} ${storeName} items deleted on another device`);
              },
            });

            // App start: only documents saved since the last pull, plus every transcript dated today or
            // yesterday. A manual sync from Settings still compares the whole collection.
            const parts = [await pull(forceManual ? undefined : { field: SYNC_STAMP_FIELD, min: getPullCheckpoint(storeName) })];
            if (isHistory && !forceManual && !shouldStop()) {
              parts.push(await pull({ field: 'date', min: startOfYesterday().toISOString() }));
            }
            if (parts.every(part => part.completed)) {
              savePullCheckpoint(storeName, pullStartedAt);
              const resent = await repair?.finish();
              if (resent) console.debug(`[Firebase Gentle Pull] Re-sending ${resent} history items compressed`);
            }

            if (isHistory && !forceManual) {
              cloudHistoryTotal = await countCloudDocs(cloudDb, storeName);
              syncStats.totalCloudHistoryDocs = cloudHistoryTotal;
              notifyListeners();
            }

            const cloudCount = parts.reduce((sum, part) => sum + part.cloudCount, 0);
            const changed = parts.reduce((sum, part) => sum + part.merged + part.removed, 0);
            if (cloudCount === 0 && changed === 0) {
              await sleep(600);
              continue;
            }

            if (changed > 0 && isHistory && onHistoryUpdated) {
              onHistoryUpdated();
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
