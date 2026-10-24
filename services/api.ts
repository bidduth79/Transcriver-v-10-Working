export { getApiUrl, getApiBaseUrl, setApiBaseUrl, DEFAULT_API_URL } from "../utils/config";
import { getApiUrl } from '../utils/config';
import { addToQueue } from './syncQueue';
import { fetchDataDual, saveDataDual, deleteDataDual } from './syncEngine';
export { fetchDataDual, saveDataDual, deleteDataDual };
import { authPromise, auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FIREBASE_SYNCED_STORES } from '../constants/storeNames';

export const checkCloudConnection = async (): Promise<{ status: 'online' | 'offline' | 'auth-error', message: string }> => {
  try {
      await authPromise;
      if (!auth || !auth.currentUser) return { status: 'auth-error', message: 'Not logged in' };
      return { status: 'online', message: 'Connected' };
  } catch(e) {
      return { status: 'offline', message: 'Connection failed' };
  }
};



export const fetchConfigDual = async (docName: string) => {
    try {
        const url = getApiUrl(`${docName}.php`);
        const res = await fetch(url);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) { 
        console.error("Failed to fetch config locally:", e);
    }
    
    try {
        await authPromise;
        if (!db) return null;
        const docRef = doc(db, "config", docName);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        if ((e as { code?: string }).code !== 'permission-denied') {
            console.warn("Config fetch failed", e);
        }
    }
    return null;
};

export const performMasterSync = async (onProgress: (msg: string, p: number) => void) => {
    try {
        const stores = FIREBASE_SYNCED_STORES;
        const totalStores = stores.length;
        const { initDB } = await import('./db');
        const idb = await initDB();

        for (let i = 0; i < totalStores; i++) {
            const store = stores[i];
            const displayStoreName = store.replace('studio_', '').toUpperCase();

            onProgress(`ধীরে ধীরে সিঙ্ক হচ্ছে: ${displayStoreName}...`, Math.round((i / totalStores) * 100));

            // Fetch from all sources (Local, IDB, Firebase, Supabase) and deduplicate
            const allData = await fetchDataDual(store, true);

            if (allData.length === 0) {
                await new Promise(r => setTimeout(r, 400));
                continue;
            }

            // Ensure merged cloud items are saved in primary IndexedDB in gentle chunks
            const idbChunkSize = 15;
            for (let k = 0; k < allData.length; k += idbChunkSize) {
                const chunk = allData.slice(k, k + idbChunkSize);
                await new Promise<void>((res) => {
                    try {
                        const tx = idb.transaction([store], 'readwrite');
                        const st = tx.objectStore(store);
                        chunk.forEach(item => st.put(item));
                        tx.oncomplete = () => res();
                        tx.onerror = () => res();
                    } catch (e) {
                        res();
                    }
                });
                await new Promise(r => setTimeout(r, 150));
            }

            // Push deduplicated data back to cloud sources gently (5 at a time with 350ms breather)
            const batchSize = 5;
            for (let j = 0; j < allData.length; j += batchSize) {
                const batch = allData.slice(j, j + batchSize);
                await Promise.all(batch.map(item => saveDataDual(store, item, true)));
                await new Promise(r => setTimeout(r, 350));
            }
        }

        onProgress("সিনক্রোনাইজ সম্পন্ন হয়েছে", 100);
        return true;
    } catch (e) {
        console.error("Master Sync Failed:", e);
        throw e;
    }
};

// NOTE: performMasterSync performs BIDIRECTIONAL merge (reads from all sources, deduplicates, writes back).
export const syncAllLocalToCloud = performMasterSync;
export const restoreAllCloudToLocal = performMasterSync;
export const restoreCloudData = performMasterSync;
