import { doc, deleteDoc, type Firestore } from 'firebase/firestore';
import { SECRET_STORES } from '../../constants/storeNames';

const CLEANUP_DONE_KEY = 'firebase_secret_cleanup_done';

/**
 * Older app versions copied API keys to Firestore, where any signed-in (even anonymous) visitor
 * might read them, depending on the security rules. Runs once per device: deletes the cloud copies
 * of the keys this device stores locally, so no key is lost. Returns how many cloud copies were removed.
 */
export const removeCloudSecretCopies = async (db: Firestore, idb: IDBDatabase) => {
  if (localStorage.getItem(CLEANUP_DONE_KEY)) return 0;
  let removed = 0;
  for (const storeName of SECRET_STORES) {
    if (!idb.objectStoreNames.contains(storeName)) continue;
    const ids = await new Promise<string[]>((resolve) => {
      const req = idb.transaction([storeName], 'readonly').objectStore(storeName).getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map(String));
      req.onerror = () => resolve([]);
    });
    for (const id of ids) {
      await deleteDoc(doc(db, storeName, id));
      removed++;
    }
  }
  localStorage.setItem(CLEANUP_DONE_KEY, new Date().toISOString());
  return removed;
};
