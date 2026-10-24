import type { Firestore } from 'firebase/firestore';
import { STORES } from '../../constants/storeNames';
import { forEachHistoryRecord } from '../historyRecords';
import { enqueueFirebaseWrite } from './pushQueue';
import { isLargePlainTranscript, utf8Length, NEAR_DOC_LIMIT_BYTES } from './transcriptCompression';

/**
 * Used by a manual sync. Afterwards it queues (through the gentle push queue) the items that should be
 * sent again, now compressed:
 * - cloud copies it came across that hold a long plain transcript (saved before compression existed)
 * - very long local transcripts missing from the cloud: over the 1 MB document limit they could not be
 *   saved. These are few, so each is looked up on its own (one read each) instead of reading everything.
 * Other items missing from the cloud are left alone, since they may have been deleted on another device.
 */
export const createHistoryRepair = (db: Firestore) => {
  const inCloud = new Set<string>();
  const toResend = new Set<string>();

  const onCloudDoc = (id: string, data: Record<string, unknown>) => {
    inCloud.add(id);
    if (isLargePlainTranscript(data)) toResend.add(id);
  };

  // Returns how many items were queued
  const finish = async () => {
    const huge: string[] = [];
    await forEachHistoryRecord(item => {
      if (!inCloud.has(item.id) && typeof item.transcript === 'string' && utf8Length(item.transcript) >= NEAR_DOC_LIMIT_BYTES) {
        huge.push(item.id);
      }
    });
    if (huge.length > 0) {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore/lite');
      const liteDb = getFirestore(db.app);
      for (const id of huge) {
        if (!(await getDoc(doc(liteDb, STORES.HISTORY, id))).exists()) toResend.add(id);
      }
    }
    toResend.forEach(id => enqueueFirebaseWrite(STORES.HISTORY, id));
    return toResend.size;
  };

  return { onCloudDoc, finish };
};
