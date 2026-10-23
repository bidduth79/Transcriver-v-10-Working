import type { Firestore } from 'firebase/firestore';
import type { QueryDocumentSnapshot, QueryConstraint, QuerySnapshot } from 'firebase/firestore/lite';
import { syncStats, notifyListeners, sleep } from './syncState';

// Documents fetched per request; only one page is held in memory at a time
export const PULL_PAGE_SIZE = 50;
const CHUNK_SIZE = 10;

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

interface PullStoreOptions {
  db: Firestore;
  idb: IDBDatabase;
  storeName: string;
  shouldStop: () => boolean;
  onCloudCount: (count: number) => void;
  onMerged: (count: number) => void;
}

/**
 * Copies cloud documents that are missing locally, one page at a time, so a large collection
 * never sits in memory at once. Stops between pages when `shouldStop` turns true.
 * Returns how many cloud documents were seen and how many were added locally.
 */
export const pullStoreInPages = async ({ db, idb, storeName, shouldStop, onCloudCount, onMerged }: PullStoreOptions) => {
  // Read through the cache-free Lite SDK: the full SDK's memory cache keeps every pulled document
  // (all transcripts) in memory for the rest of the session. Loaded only when a pull runs.
  const { getFirestore, collection, getDocs, query, orderBy, limit, startAfter, documentId, setLogLevel } = await import('firebase/firestore/lite');
  setLogLevel('silent'); // Same as the full SDK in services/firebase.ts: errors are handled here
  const liteDb = getFirestore(db.app);
  let existingKeys: Set<string> | null = null;
  let lastDoc: QueryDocumentSnapshot | null = null;
  let cloudCount = 0;
  let merged = 0;

  while (true) {
    const constraints: QueryConstraint[] = lastDoc
      ? [orderBy(documentId()), startAfter(lastDoc), limit(PULL_PAGE_SIZE)]
      : [orderBy(documentId()), limit(PULL_PAGE_SIZE)];
    const snap: QuerySnapshot = await getDocs(query(collection(liteDb, storeName), ...constraints));
    cloudCount += snap.size;
    onCloudCount(cloudCount);

    if (snap.empty) break;
    if (!existingKeys) existingKeys = await getLocalKeys(idb, storeName);

    // শুধুমাত্র যে ডকুমেন্টগুলো লোকালে নেই সেগুলো আলাদা করুন (যাতে অযথা ডুপ্লিকেট রাইট না হয়)
    const missingDocs: any[] = [];
    snap.forEach((docSnap) => {
      const docId = String(docSnap.id);
      if (!existingKeys!.has(docId)) {
        missingDocs.push({ id: docId, ...docSnap.data() });
      }
    });

    if (missingDocs.length > 0) {
      syncStats.statusMessageBn = `${storeName} থেকে ${missingDocs.length}টি নতুন ডাটা ধীরে ধীরে যুক্ত হচ্ছে...`;
      notifyListeners();

      // ১০টি করে ছোট ব্যাচে সেভ করুন এবং প্রতি ব্যাচের মাঝে ২৫০ms বিরতি দিন (Zero UI Pressure)
      for (let i = 0; i < missingDocs.length; i += CHUNK_SIZE) {
        const chunk = missingDocs.slice(i, i + CHUNK_SIZE);
        await putChunk(idb, storeName, chunk);
        merged += chunk.length;
        onMerged(chunk.length);
        await sleep(250);
      }
    }

    if (snap.size < PULL_PAGE_SIZE || shouldStop()) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { cloudCount, merged };
};
