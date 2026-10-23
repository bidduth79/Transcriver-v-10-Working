import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { collection, getDocs } from "firebase/firestore";
import { getApiUrl, isLocalServerEnabled } from '../../utils/config';
import { supabase, isSupabaseConfigured } from '../supabase';
import { withoutSyncStamp } from '../firebaseSync/syncStamp';
import { unpackFromCloud } from '../firebaseSync/transcriptCompression';

// Readers for each storage backend. Every reader resolves to [] on failure so one source never blocks the others.

export const fetchFromPrimaryIdb = async (storeName: string): Promise<any[]> => {
  try {
    const { initDB } = await import('../db');
    const idb = await initDB();
    return await new Promise<any[]>((resolve) => {
      try {
        const tx = idb.transaction([storeName], 'readonly');
        const st = tx.objectStore(storeName);
        const req = st.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  } catch (e) {
    return [];
  }
};

export const fetchFromLocalApi = async (storeName: string): Promise<any[]> => {
  // If local server is disabled, do not attempt to contact 127.0.0.1
  if (!isLocalServerEnabled()) return [];
  let allLocalData: any[] = [];
  try {
    let page = 1;
    const limit = 200; // Safe chunk size

    while (true) {
      const url = getApiUrl(`api.php?action=get&store=${storeName}&page=${page}&limit=${limit}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            const items = data.map((row: any) => row.data || row);
            allLocalData = allLocalData.concat(items);
            if (items.length < limit) break; // Reached the end
          } else {
            break; // Invalid format
          }
        } catch (jsonErr) {
          console.warn(`[Local Fetch] Invalid JSON for ${storeName} on page ${page}`);
          break;
        }
      } else {
        break; // HTTP error
      }
      page++;
    }
    return allLocalData;
  } catch (e) {
    return allLocalData;
  }
};

export const fetchFromFirebase = async (storeName: string): Promise<any[]> => {
  if (!isFirebaseConfigured || !db) return [];
  try {
    await authPromise;
    const querySnapshot = await getDocs(collection(db, storeName));
    // Long history transcripts are stored gzipped in the cloud
    return await Promise.all(querySnapshot.docs.map(async d => ({ id: d.id, ...await unpackFromCloud(withoutSyncStamp(d.data())) })));
  } catch (e) {
    return [];
  }
};

export const fetchFromSupabase = async (storeName: string): Promise<any[]> => {
  if (!isSupabaseConfigured) return [];
  try {
    let allSupabaseData: any[] = [];
    let from = 0;
    const limit = 50;

    while (true) {
      const { data, error } = await supabase.from(storeName).select('*').range(from, from + limit - 1);

      if (error) {
        console.warn(`[Supabase Fetch] Info for ${storeName}:`, error.message || error);
        break;
      }

      if (data && data.length > 0) {
        allSupabaseData = allSupabaseData.concat(data);
        if (data.length < limit) break;
        from += limit;
      } else {
        break;
      }
    }
    return allSupabaseData.map((row: any) => row.data || row);
  } catch (e) {
    return [];
  }
};
