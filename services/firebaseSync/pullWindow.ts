import type { Firestore } from 'firebase/firestore';

const CHECKPOINT_PREFIX = 'firebase_pull_checkpoint_';
// The device clock and Firestore's clock can differ; overlap is harmless because only missing documents are added
const CLOCK_SKEW_MS = 10 * 60 * 1000;

// Midnight at the start of yesterday, in the user's time zone: today's and yesterday's data always come down
export const startOfYesterday = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

// Pull documents saved after this moment; before the first pull, everything saved since yesterday
export const getPullCheckpoint = (storeName: string, now = new Date()) => {
  const saved = Number(localStorage.getItem(CHECKPOINT_PREFIX + storeName));
  return saved > 0 ? new Date(saved) : startOfYesterday(now);
};

// Called only after a store was read to the end, with the time that pull started
export const savePullCheckpoint = (storeName: string, pullStartedAt: number) => {
  localStorage.setItem(CHECKPOINT_PREFIX + storeName, String(pullStartedAt - CLOCK_SKEW_MS));
};

// Number of documents in a cloud collection, counted by Firestore (about one read per 1000 documents)
export const countCloudDocs = async (db: Firestore, storeName: string) => {
  const { getFirestore, collection, getCount } = await import('firebase/firestore/lite');
  const snapshot = await getCount(collection(getFirestore(db.app), storeName));
  return snapshot.data().count;
};
