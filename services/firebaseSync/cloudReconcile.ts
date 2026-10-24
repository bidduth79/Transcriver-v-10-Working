import type { Firestore } from 'firebase/firestore';
import { STORES } from '../../constants/storeNames';
import { forEachHistoryRecord } from '../historyRecords';
import { useHistoryStore } from '../../hooks/useHistoryStore';
import { countCloudDocs, startOfYesterday } from './pullWindow';

// A slice of a store by its ISO `date` text: at least `min`, below `max` ('2026-10' covers that month)
export interface DateRange { field: 'date'; min: string; max?: string }

const nextMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
};

// Every 'YYYY-MM' from `first` to `last`
export const monthsBetween = (first: string, last: string) => {
  const months: string[] = [];
  for (let month = first; month <= last; month = nextMonth(month)) months.push(month);
  return months;
};

// Dates of this device's history: the list already in memory, or IndexedDB while it is still loading
export const localHistoryDates = async () => {
  const listed = useHistoryStore.getState().history;
  if (listed.length > 0) return listed.map(item => item.date || '');
  const dates: string[] = [];
  await forEachHistoryRecord(item => { dates.push(item.date || ''); });
  return dates;
};

type LiteSdk = typeof import('firebase/firestore/lite');

const inRange = (date: string, { min, max }: DateRange) => date >= min && (max === undefined || date < max);

// True when the cloud has more items in the range than this device: only then is it worth reading.
// Firestore charges one read per 1000 documents counted, however many documents match.
const cloudHasMore = async (sdk: LiteSdk, db: Firestore, storeName: string, range: DateRange, localDates: string[]) => {
  const { getFirestore, collection, query, where, getCount } = sdk;
  const limits = [where(range.field, '>=', range.min), ...(range.max === undefined ? [] : [where(range.field, '<', range.max)])];
  const cloud = (await getCount(query(collection(getFirestore(db.app), storeName), ...limits))).data().count;
  return cloud > localDates.filter(date => inRange(date, range)).length;
};

export const isRangeMissingLocally = async (db: Firestore, storeName: string, range: DateRange, localDates: string[]) =>
  cloudHasMore(await import('firebase/firestore/lite'), db, storeName, range, localDates);

/**
 * The months of history that have items missing on this device. Instead of reading every document
 * (one read each), each month is counted in the cloud: about one read per month, plus one for the oldest date.
 */
export const findMissingHistoryMonths = async (db: Firestore, localDates: string[], now = new Date()): Promise<DateRange[]> => {
  const sdk = await import('firebase/firestore/lite');
  const { getFirestore, collection, query, where, orderBy, limit, getDocs } = sdk;
  const items = collection(getFirestore(db.app), STORES.HISTORY);
  const oldest = await getDocs(query(items, where('date', '>=', '2000'), orderBy('date'), limit(1)));
  if (oldest.empty) return [];
  const ranges: DateRange[] = monthsBetween(String(oldest.docs[0].data().date).slice(0, 7), now.toISOString().slice(0, 7))
    .map(month => ({ field: 'date', min: month, max: nextMonth(month) }));
  const missing = await Promise.all(ranges.map(range => cloudHasMore(sdk, db, STORES.HISTORY, range, localDates)));
  return ranges.filter((_, i) => missing[i]);
};

const countLocal = (idb: IDBDatabase, storeName: string) => new Promise<number>((resolve) => {
  try {
    const req = idb.transaction([storeName], 'readonly').objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  } catch {
    resolve(0);
  }
});

/**
 * What to read after the "saved since the last pull" step, so that only missing data costs reads:
 * - history at app start: today and yesterday, if the cloud has more of them than this device
 * - history on a manual sync: the months where the cloud has more items
 * - other stores on a manual sync: the whole store, if the cloud has more items
 * `undefined` in the list stands for the whole store.
 */
export const rangesMissingLocally = async (db: Firestore, idb: IDBDatabase, storeName: string, manual: boolean): Promise<(DateRange | undefined)[]> => {
  if (storeName === STORES.HISTORY) {
    const dates = await localHistoryDates();
    if (manual) return findMissingHistoryMonths(db, dates);
    const recent: DateRange = { field: 'date', min: startOfYesterday().toISOString() };
    return (await isRangeMissingLocally(db, storeName, recent, dates)) ? [recent] : [];
  }
  if (!manual) return [];
  return (await countCloudDocs(db, storeName)) > (await countLocal(idb, storeName)) ? [undefined] : [];
};
