import type { HistoryItem } from '../../types';

// A changed transcript (a speaker renamed, punctuation fixed) saved to its history item and to the small cache of
// opened transcripts. Nothing happens for a transcript that is not saved in the history.
export const saveHistoryTranscript = async (historyId: string | null | undefined, transcript: string) => {
  if (!historyId) return;
  const { getFromStore, addToStore, STORES } = await import('../../services/db');
  const item = await getFromStore(STORES.HISTORY, historyId) as HistoryItem | undefined;
  if (!item) return;
  item.transcript = transcript;
  await addToStore(STORES.HISTORY, item);
  const { rememberHistoryTranscript } = await import('./useHistoryTranscript');
  rememberHistoryTranscript(historyId, transcript);
};
