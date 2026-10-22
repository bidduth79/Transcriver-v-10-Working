import { db, authPromise, isFirebaseConfigured } from './firebase';
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getApiUrl, isLocalServerEnabled } from '../utils/config';
import { supabase, isSupabaseConfigured } from './supabase';
import { addToQueue } from './syncQueue';
import { FIREBASE_SYNCED_STORES } from '../constants/storeNames';
import { enqueueFirebaseWrite, enqueueFirebaseDelete } from './firebaseThrottledQueue';
import { fetchFromPrimaryIdb, fetchFromLocalApi, fetchFromFirebase, fetchFromSupabase } from './sync/syncSources';

// ============================================================================
// 🌐 ক্লাউড ও জেম্প সার্ভার ব্যাকগ্রাউন্ড অটো-সেভ নিয়ন্ত্রণ (Auto Cloud Save Toggles)
// ----------------------------------------------------------------------------
// Local XAMPP server sync is dynamically controlled via isLocalServerEnabled() (Settings toggle)
export const AUTO_SYNC_XAMPP_ENABLED = false; // Kept for compatibility; use isLocalServerEnabled()
export const AUTO_SYNC_SUPABASE_ENABLED = false;  // Supabase অটো সেভ
export const AUTO_SYNC_FIREBASE_ENABLED = true;   // Firebase ব্যাকগ্রাউন্ড অটো সেভ (ধীরে ধীরে ব্যাকগ্রাউন্ডে প্রেরিত)
// ============================================================================

// TRIPLE-SYNC READ
export const fetchDataDual = async (storeName: string, forceAll = false) => {
  const promises: Promise<any[]>[] = [
    fetchFromPrimaryIdb(storeName),
  ];

  if (forceAll || AUTO_SYNC_XAMPP_ENABLED) {
    promises.push(fetchFromLocalApi(storeName));
  }

  if (FIREBASE_SYNCED_STORES.includes(storeName)) {
    if (forceAll || AUTO_SYNC_FIREBASE_ENABLED) {
      promises.push(fetchFromFirebase(storeName));
    }
    if (forceAll || AUTO_SYNC_SUPABASE_ENABLED) {
      promises.push(fetchFromSupabase(storeName));
    }
  }

  const results = await Promise.all(promises);
  const allData = results.flat();
  
  // Deduplicate by ID
  const uniqueDataMap = new Map();
  allData.forEach((item: any) => {
    if (item && item.id) {
      const idStr = String(item.id);
      uniqueDataMap.set(idStr, { ...item, id: idStr });
    }
  });
  
  return Array.from(uniqueDataMap.values());
};

// TRIPLE-SYNC WRITE
export const saveDataDual = async (storeName: string, data: any, forceAll = false) => {
  const id = String(data.id || Date.now());
  const payload = { ...data, id };

  const isSyncedStore = FIREBASE_SYNCED_STORES.includes(storeName);
  const promises = [];

  // 1. XAMPP Local Write
  if ((forceAll && isLocalServerEnabled()) || isLocalServerEnabled()) {
    promises.push(
      fetch(getApiUrl(`api.php?action=save&store=${storeName}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
          if (!res.ok) throw new Error("Local HTTP Failed");
      }).catch((e) => {
          if (isLocalServerEnabled()) {
            addToQueue('local', 'save', storeName, id, payload);
          }
      })
    );
  }

  if (isSyncedStore) {
    // 2. Firebase Write (with gentle throttled background queue)
    if (isFirebaseConfigured && db) {
      if (forceAll) {
        // Immediate sync if manual master sync is running from Settings
        promises.push(
          authPromise.then(() => setDoc(doc(db!, storeName, id), payload))
            .catch(e => console.warn("Firebase immediate sync warning:", e.message))
        );
      } else if (AUTO_SYNC_FIREBASE_ENABLED) {
        // Non-blocking gentle throttled dispatch (আস্তে আস্তে সময় বাচিয়ে পাঠাবে)
        enqueueFirebaseWrite(storeName, id, payload);
      }
    }

    // 3. Supabase Write (with config guard)
    if ((forceAll || AUTO_SYNC_SUPABASE_ENABLED) && isSupabaseConfigured) {
      promises.push(
        Promise.resolve(supabase.from(storeName).upsert({ id: id, data: payload })).then(({ error }: any) => {
            if (error) throw error;
        }).catch((e: any) => {
            console.warn("Supabase save failed, queuing...", e.message);
            if (AUTO_SYNC_SUPABASE_ENABLED) {
              addToQueue('supabase', 'save', storeName, id, payload);
            }
        })
      );
    }
  }

  await Promise.allSettled(promises);
  return true;
};

// TRIPLE-SYNC DELETE
export const deleteDataDual = async (storeName: string, id: string, forceAll = false) => {
  const isSyncedStore = FIREBASE_SYNCED_STORES.includes(storeName);
  const promises = [];

  if ((forceAll && isLocalServerEnabled()) || isLocalServerEnabled()) {
    promises.push(
      fetch(getApiUrl(`api.php?action=delete&store=${storeName}&id=${id}`))
        .then(res => { if (!res.ok) throw new Error("Local HTTP Failed"); })
        .catch((e) => {
          if (isLocalServerEnabled()) {
            addToQueue('local', 'delete', storeName, id);
          }
        })
    );
  }

  if (isSyncedStore) {
    // Firebase delete (with gentle throttled background queue)
    if (isFirebaseConfigured && db) {
      if (forceAll) {
        promises.push(
          authPromise.then(() => deleteDoc(doc(db!, storeName, id)))
            .catch(e => console.warn("Firebase immediate delete warning:", e.message))
        );
      } else if (AUTO_SYNC_FIREBASE_ENABLED) {
        enqueueFirebaseDelete(storeName, id);
      }
    }

    // Supabase delete (with config guard)
    if ((forceAll || AUTO_SYNC_SUPABASE_ENABLED) && isSupabaseConfigured) {
      promises.push(
        Promise.resolve(supabase.from(storeName).delete().eq('id', id)).then(({ error }: any) => {
            if (error) throw error;
        }).catch((e: any) => {
          if (AUTO_SYNC_SUPABASE_ENABLED) {
            addToQueue('supabase', 'delete', storeName, id);
          }
        })
      );
    }
  }

  await Promise.allSettled(promises);
  return true;
};
