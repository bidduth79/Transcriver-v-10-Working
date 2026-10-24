import { serverTimestamp } from 'firebase/firestore';

/**
 * Set by Firestore's own clock on every save. A pull asks only for documents saved after its last
 * checkpoint, instead of reading whole collections on every app start.
 */
export const SYNC_STAMP_FIELD = '_syncedAt';

export const withSyncStamp = (payload: Record<string, unknown>) => ({ ...payload, [SYNC_STAMP_FIELD]: serverTimestamp() });

// The stamp only matters in the cloud; local records are stored without it
export const withoutSyncStamp = <T extends Record<string, unknown>>(data: T) => {
  const { [SYNC_STAMP_FIELD]: _stamp, ...rest } = data;
  return rest;
};
