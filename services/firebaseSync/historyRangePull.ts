import { db, authPromise, isFirebaseConfigured } from '../firebase';
import { STORES } from '../../constants/storeNames';
import { useAppStore } from '../../hooks/useAppStore';
import { pullStoreInPages } from './pullStorePages';
import { startOfYesterday } from './pullWindow';
import { isRangeMissingLocally, localHistoryDates, type DateRange } from './cloudReconcile';

// Days (YYYY-MM-DD) already brought from the cloud, so looking at them again costs no reads
const FETCHED_DAYS_KEY = 'firebase_fetched_history_days';

// The history list groups items by the date part of their ISO `date`, so days here are those same (UTC) days
const utcDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const readFetchedDays = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(FETCHED_DAYS_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
};

/**
 * On demand: brings the history items of `days` list days starting at the calendar day `from` from the cloud.
 * Today and yesterday arrive with every app start; older days are read only when asked for, and
 * each day only once. Returns how many items were added locally (the list then reloads).
 */
export const fetchHistoryDaysFromCloud = async (from: Date, days = 1): Promise<number> => {
  if (!isFirebaseConfigured || !db || !navigator.onLine) return 0;
  const start = utcDay(from.getFullYear(), from.getMonth(), from.getDate());
  const end = utcDay(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const dayKeys = Array.from({ length: days }, (_, i) => dayKey(utcDay(from.getFullYear(), from.getMonth(), from.getDate() + i)));
  const fetched = readFetchedDays();
  if (dayKeys.every(key => fetched.has(key))) return 0;

  await authPromise;
  const range: DateRange = { field: 'date', min: start.toISOString(), max: end.toISOString() };
  // Counting first costs one read; days this device already has in full are then not read at all
  const missing = await isRangeMissingLocally(db, STORES.HISTORY, range, await localHistoryDates());
  const { initDB } = await import('../db');
  const { merged, completed } = missing
    ? await pullStoreInPages({ db, idb: await initDB(), storeName: STORES.HISTORY, since: range, shouldStop: () => !navigator.onLine, onMerged: () => {} })
    : { merged: 0, completed: true };

  // Recent days can still change, so only older ones are remembered
  if (completed) {
    const yesterday = startOfYesterday();
    const recent = dayKey(utcDay(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));
    dayKeys.filter(key => key < recent).forEach(key => fetched.add(key));
    localStorage.setItem(FETCHED_DAYS_KEY, JSON.stringify([...fetched]));
  }
  if (merged > 0) useAppStore.getState().triggerStoreUpdate(STORES.HISTORY);
  return merged;
};

const OLDER_CURSOR_KEY = 'firebase_older_history_cursor';
const OLDER_STEP_DAYS = 7;

/**
 * "Load older": each call brings the 7 list days before the oldest point reached so far (the oldest
 * local item, or where the previous call stopped). Returns how many items were added, or null when
 * the cloud cannot be reached (nothing is read and the position does not move).
 */
export const fetchOlderHistoryFromCloud = async (oldestLocalIso?: string): Promise<number | null> => {
  if (!isFirebaseConfigured || !db || !navigator.onLine) return null;
  const candidates = [localStorage.getItem(OLDER_CURSOR_KEY), oldestLocalIso?.slice(0, 10)].filter(Boolean) as string[];
  const boundary = candidates.sort()[0] ?? dayKey(new Date());
  const [year, month, day] = boundary.split('-').map(Number);
  const added = await fetchHistoryDaysFromCloud(new Date(year, month - 1, day - OLDER_STEP_DAYS), OLDER_STEP_DAYS);
  localStorage.setItem(OLDER_CURSOR_KEY, dayKey(utcDay(year, month - 1, day - OLDER_STEP_DAYS)));
  return added;
};
