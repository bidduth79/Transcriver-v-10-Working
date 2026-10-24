import { initDB, addToStore, getFromStore, STORES } from './db';
import type { HistoryItem } from '../types';

/**
 * Saved transcripts live only in IndexedDB. The in-memory history list holds "light" items
 * (every field except the transcript text), so thousands of transcripts never sit in memory.
 */
export const toLightHistoryItem = <T extends Record<string, unknown>>(item: T): Omit<T, 'transcript' | 'text'> => {
  const { transcript: _transcript, text: _text, ...light } = item;
  return light;
};

// Visits every saved history record one at a time, so only one transcript is in memory at once
export const forEachHistoryRecord = async (visit: (item: HistoryItem) => void) => {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction([STORES.HISTORY], 'readonly').objectStore(STORES.HISTORY).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      visit(cursor.value as HistoryItem);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
};

export const loadLightHistory = async () => {
  const items: HistoryItem[] = [];
  await forEachHistoryRecord(item => items.push(toLightHistoryItem(item) as HistoryItem));
  return items;
};

export const getHistoryRecord = async (id: string) =>
  (await getFromStore(STORES.HISTORY, id)) as HistoryItem | undefined;

export const getHistoryTranscript = async (id: string): Promise<string> =>
  (await getHistoryRecord(id))?.transcript || '';

// Ids of saved records whose transcript (or legacy `text`) matches the pattern
export const findHistoryIdsByTranscript = async (pattern: RegExp) => {
  const ids = new Set<string>();
  await forEachHistoryRecord(item => {
    if (pattern.test(item.transcript || item.text || '')) ids.add(item.id);
  });
  return ids;
};

/**
 * Applies a change to the saved record. The record is read back from IndexedDB first, so a light
 * in-memory item can never overwrite (and erase) the stored transcript. Does nothing if it is not saved.
 */
export const updateHistoryRecord = async (id: string, patch: Partial<HistoryItem>) => {
  const saved = await getHistoryRecord(id);
  if (!saved) return false;
  await addToStore(STORES.HISTORY, { ...saved, ...patch, id });
  return true;
};
