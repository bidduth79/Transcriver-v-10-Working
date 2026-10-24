import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { FIREBASE_SYNCED_STORES, STORES } from '../../constants/storeNames';
import { runtime, syncStats, notifyListeners, isHeavyProcessingActive, sleep } from './syncState';
import { pullStoreInPages } from './pullStorePages';
import { removeCloudSecretCopies } from './secretCleanup';
import { SYNC_STAMP_FIELD } from './syncStamp';
import { getPullCheckpoint, savePullCheckpoint, countCloudDocs } from './pullWindow';
import { rangesMissingLocally, type DateRange } from './cloudReconcile';
import { messageOf } from '../../utils/errorMessage';
import { pullFailureOf, PULL_FAILURE_TEXT, type PullFailure } from './pullFailure';
import { uiText } from '../../utils/uiText';
import { currentAppLang } from '../../hooks/useThemeStore';

/**
 * কোনোরকম চাপ বা ফ্রিজ ছাড়াই ফায়ারবেইজ থেকে নতুন ডাটা ছোট ছোট চ্যাংকে (Chunk) লোকাল IndexedDB-তে নিয়ে আসে।
 * এটি অ্যাপ ওপেন হওয়ার পর নিঃশব্দে একবার চলে, অথবা সেটিংস থেকে ম্যানুয়ালি চালানো যায়।
 */
export const scheduleGentleFirebasePull = (
  onHistoryUpdated?: () => void,
  forceManual = false
): Promise<{ pulledCount: number; cloudTotal: number; failure?: PullFailure }> => {
  if (!isFirebaseConfigured || !db) {
    syncStats.statusMessageBn = uiText(currentAppLang(), 'firebaseNotConfiguredEnv');
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
      syncStats.statusMessageBn = uiText(currentAppLang(), 'firebaseCheckingGently');
      notifyListeners();

      let totalNewItemsMerged = 0;
      let cloudHistoryTotal = 0;
      let failure: PullFailure | undefined;

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
        } catch (cleanupErr) {
          console.warn('[Firebase Gentle Pull] API key cleanup notice:', messageOf(cleanupErr) || cleanupErr);
        }
        const pullStartedAt = Date.now();
        const shouldStop = () => !navigator.onLine || (!forceManual && isHeavyProcessingActive());

        for (const storeName of FIREBASE_SYNCED_STORES) {
          if (shouldStop()) break;

          try {
            const isHistory = storeName === STORES.HISTORY;
            // A manual sync also re-sends, compressed, the long history items it comes across
            const repair = isHistory && forceManual ? (await import('./cloudRepair')).createHistoryRepair(cloudDb) : null;
            const pull = (since?: DateRange | { field: string; min: Date }) => pullStoreInPages({
              db: cloudDb, idb, storeName, shouldStop, since, onCloudDoc: repair?.onCloudDoc,
              onMerged: (count) => {
                totalNewItemsMerged += count;
                syncStats.lastPulledCount = totalNewItemsMerged;
                notifyListeners();
              },
              onRemoved: (count) => {
                if (count > 0) console.debug(`[Firebase Gentle Pull] Removed ${count} ${storeName} items deleted on another device`);
              },
            });

            // First the documents saved since the last pull; then only the parts where counting shows the
            // cloud has more than this device (counting costs about one read per 1000 documents)
            const parts = [await pull({ field: SYNC_STAMP_FIELD, min: getPullCheckpoint(storeName) })];
            for (const range of shouldStop() ? [] : await rangesMissingLocally(cloudDb, idb, storeName, forceManual)) {
              if (shouldStop()) break;
              parts.push(await pull(range));
            }
            if (parts.every(part => part.completed)) {
              savePullCheckpoint(storeName, pullStartedAt);
              const resent = await repair?.finish();
              if (resent) console.debug(`[Firebase Gentle Pull] Re-sending ${resent} history items compressed`);
            }

            if (isHistory) {
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
          } catch (storeErr) {
            console.warn(`[Firebase Gentle Pull] Notice on ${storeName}:`, messageOf(storeErr) || storeErr);
            failure = pullFailureOf(storeErr);
            if (failure === 'quota') break; // Every other store would be refused the same way
          }

          // পরবর্তী স্টোর চেক করার আগে ১.২ সেকেন্ড বিরতি নিন
          await sleep(1200);
        }

        syncStats.lastSyncTime = new Date().toLocaleTimeString('bn-BD');
        syncStats.statusMessageBn = failure ? uiText(currentAppLang(), PULL_FAILURE_TEXT[failure]) : totalNewItemsMerged > 0
          ? uiText(currentAppLang(), 'firebaseMergedSummary', { merged: totalNewItemsMerged, total: cloudHistoryTotal })
          : uiText(currentAppLang(), 'firebaseAllLocal', { total: cloudHistoryTotal });
      } catch (err) {
        console.warn("[Firebase Gentle Pull] Error:", messageOf(err) || err);
        failure = pullFailureOf(err);
        syncStats.statusMessageBn = failure === 'quota' ? uiText(currentAppLang(), PULL_FAILURE_TEXT.quota) : uiText(currentAppLang(), 'firebaseUnavailable');
      } finally {
        runtime.isPullRunning = false;
        notifyListeners();
        resolve({ pulledCount: totalNewItemsMerged, cloudTotal: cloudHistoryTotal, failure });
      }
    }, startDelay);
  });
};
