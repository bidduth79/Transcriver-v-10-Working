import type { Firestore } from 'firebase/firestore';
import type { QueryDocumentSnapshot, QueryConstraint, QuerySnapshot } from 'firebase/firestore/lite';
import { syncStats, notifyListeners, sleep } from './syncState';
import { withoutSyncStamp } from './syncStamp';
import { unpackFromCloud } from './transcriptCompression';
import { isTombstone } from './tombstone';

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

const deleteKeys = (idb: IDBDatabase, storeName: string, ids: string[]) => new Promise<void>((res) => {
  try {
    const tx = idb.transaction([storeName], 'readwrite');
    const st = tx.objectStore(storeName);
    ids.forEach(id => st.delete(id));
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
  // Local items removed because they were deleted on another device
  onRemoved?: (count: number) => void;
  // Only documents whose `field` is at least `min` and below `max` (a Date is compared as a Firestore timestamp)
  since?: { field: string; min: string | Date; max?: string };
  // Sees every cloud document read (also ones already stored locally)
  onCloudDoc?: (id: string, data: Record<string, any>) => void;
}

/**
 * Copies cloud documents that are missing locally, one page at a time, so a large collection
 * never sits in memory at once. Stops between pages when `shouldStop` turns true.
 * A deletion marker removes the local copy instead. Returns how many cloud items were seen, how many were
 * added and removed locally, and whether it read to the end.
 */
export const pullStoreInPages = async ({ db, idb, storeName, shouldStop, onCloudCount, onMerged, onRemoved, since, onCloudDoc }: PullStoreOptions) => {
  // Read through the cache-free Lite SDK: the full SDK's memory cache keeps every pulled document
  // (all transcripts) in memory for the rest of the session. Loaded only when a pull runs.
  const { getFirestore, collection, getDocs, query, orderBy, limit, startAfter, documentId, setLogLevel, where, Timestamp } = await import('firebase/firestore/lite');
  setLogLevel('silent'); // Same as the full SDK in services/firebase.ts: errors are handled here
  const liteDb = getFirestore(db.app);
  let existingKeys: Set<string> | null = null;
  let lastDoc: QueryDocumentSnapshot | null = null;
  let cloudCount = 0;
  let merged = 0;
  let removed = 0;
  let completed = false;
  const filter: QueryConstraint[] = since
    ? [
        where(since.field, '>=', since.min instanceof Date ? Timestamp.fromDate(since.min) : since.min),
        ...(since.max !== undefined ? [where(since.field, '<', since.max)] : []),
        orderBy(since.field),
      ]
    : [orderBy(documentId())];

  while (true) {
    const constraints: QueryConstraint[] = lastDoc
      ? [...filter, startAfter(lastDoc), limit(PULL_PAGE_SIZE)]
      : [...filter, limit(PULL_PAGE_SIZE)];
    const snap: QuerySnapshot = await getDocs(query(collection(liteDb, storeName), ...constraints));
    cloudCount += snap.docs.filter(docSnap => !isTombstone(docSnap.data())).length;
    onCloudCount(cloudCount);
    if (snap.empty) { completed = true; break; }
    if (!existingKeys) existingKeys = await getLocalKeys(idb, storeName);

    // শুধুমাত্র যে ডকুমেন্টগুলো লোকালে নেই সেগুলো আলাদা করুন (যাতে অযথা ডুপ্লিকেট রাইট না হয়)
    const packedDocs: any[] = [];
    const deletedIds: string[] = [];
    snap.forEach((docSnap) => {
      const docId = String(docSnap.id);
      onCloudDoc?.(docId, docSnap.data());
      if (isTombstone(docSnap.data())) {
        if (existingKeys!.has(docId)) deletedIds.push(docId);
      } else if (!existingKeys!.has(docId)) {
        packedDocs.push({ id: docId, ...withoutSyncStamp(docSnap.data()) });
      }
    });
    if (deletedIds.length > 0) {
      await deleteKeys(idb, storeName, deletedIds);
      deletedIds.forEach(id => existingKeys!.delete(id));
      removed += deletedIds.length;
      onRemoved?.(deletedIds.length);
    }

    // Long transcripts are stored gzipped in the cloud
    const missingDocs = await Promise.all(packedDocs.map(item => unpackFromCloud(item)));

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

    if (snap.size < PULL_PAGE_SIZE) { completed = true; break; }
    if (shouldStop()) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { cloudCount, merged, removed, completed };
};
