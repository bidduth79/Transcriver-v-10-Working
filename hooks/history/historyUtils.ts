import { HistoryItem } from '../../types';
import { addToStore, STORES } from '../../services/db';

export interface HistoryFilters {
  search: string;
  date: string;
  favoritesOnly: boolean;
  sentiment: string;
}

// Transcript text is not kept in memory: `transcriptMatchIds` holds the ids whose saved transcript matched
export const matchesTranscript = (item: HistoryItem, searchRegex: RegExp, transcriptMatchIds?: Set<string> | null) =>
  item.transcript !== undefined || item.text !== undefined
    ? searchRegex.test(item.transcript || item.text || '')
    : !!transcriptMatchIds?.has(item.id);

// Search (file name or transcript), exact-day, favorites and BGB sentiment filters
export const filterHistoryItems = (
  history: HistoryItem[], { search, date, favoritesOnly, sentiment }: HistoryFilters, transcriptMatchIds?: Set<string> | null
) => {
  if (!search && !date && !favoritesOnly && sentiment === 'All') return history;
  const searchRegex = search.trim() ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

  return history.filter(item => {
    let matchesSearch = true;
    if (searchRegex) {
      const rawFileName = item.fileName || '';
      const displayFileName = rawFileName.replace(/_/g, ' ').replace(/#/g, '').replace(/\s+/g, ' ').trim();
      matchesSearch = searchRegex.test(rawFileName) || 
                      searchRegex.test(displayFileName) || 
                      matchesTranscript(item, searchRegex, transcriptMatchIds);
    }
    const matchesDate = date ? (item.date && typeof item.date === 'string' ? item.date.startsWith(date) : false) : true;
    const matchesFavorite = favoritesOnly ? !!item?.isFavorite : true;
    const matchesSentiment = sentiment === 'All' ? true : item?.bgbRemark === sentiment;
    return matchesSearch && matchesDate && matchesFavorite && matchesSentiment;
  });
};

// Downloads the whole history as licell_history_backup_<YYYY-MM-DD>.json
export const downloadHistoryBackup = (history: HistoryItem[]) => {
  const jsonStr = JSON.stringify(history);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", url);
  downloadAnchorNode.setAttribute("download", `licell_history_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  URL.revokeObjectURL(url);
};

// Imports items that have id, date and transcript; throws on a non-array file
export const restoreHistoryFromFile = async (file: File) => {
    const text = await file.text();
    const items = JSON.parse(text);
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.id && item.date && item.transcript) {
          await addToStore(STORES.HISTORY, item);
        }
      }
  } else {
    throw new Error("Invalid format");
  }
};
