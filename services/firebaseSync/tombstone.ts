import { withSyncStamp } from './syncStamp';

/**
 * A deleted item is not removed from the cloud but replaced by this small marker. It gets a fresh sync
 * stamp, so other devices' incremental pulls see it and delete their own copy.
 */
export const DELETED_FIELD = '_deleted';

export const tombstoneFor = (id: string) => withSyncStamp({ id, [DELETED_FIELD]: true });

export const isTombstone = (data: Record<string, unknown> | undefined | null) => data?.[DELETED_FIELD] === true;
