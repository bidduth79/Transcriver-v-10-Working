/**
 * Asks the browser to keep this site's storage (IndexedDB with all saved transcripts) even when
 * the disk runs low. Without it, "best-effort" storage can be cleared by the browser.
 * Chrome decides silently; some browsers may show a one-time prompt. Returns whether storage is persistent.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('Persistent storage request failed:', err);
    return false;
  }
};
