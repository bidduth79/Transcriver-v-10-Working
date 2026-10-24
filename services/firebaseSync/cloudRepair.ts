import { STORES } from '../../constants/storeNames';
import { forEachHistoryRecord } from '../historyRecords';
import { enqueueFirebaseWrite } from './pushQueue';
import { isLargePlainTranscript, utf8Length, NEAR_DOC_LIMIT_BYTES } from './transcriptCompression';

/**
 * Used by a full manual sync, which reads every cloud history document anyway. Afterwards it queues
 * (through the gentle push queue) the items that should be sent again, now compressed:
 * - cloud copies holding a long plain transcript (saved before compression existed)
 * - very long local transcripts missing from the cloud: over the 1 MB document limit they could not be saved
 * Other items missing from the cloud are left alone, since they may have been deleted on another device.
 */
export const createHistoryRepair = () => {
  const inCloud = new Set<string>();
  const toResend = new Set<string>();

  const onCloudDoc = (id: string, data: Record<string, unknown>) => {
    inCloud.add(id);
    if (isLargePlainTranscript(data)) toResend.add(id);
  };

  // Returns how many items were queued
  const finish = async () => {
    await forEachHistoryRecord(item => {
      if (!inCloud.has(item.id) && typeof item.transcript === 'string' && utf8Length(item.transcript) >= NEAR_DOC_LIMIT_BYTES) {
        toResend.add(item.id);
      }
    });
    toResend.forEach(id => enqueueFirebaseWrite(STORES.HISTORY, id));
    return toResend.size;
  };

  return { onCloudDoc, finish };
};
