import { useEffect, useCallback, useMemo } from 'react';
import { getAllFromStore, deleteFromStore, STORES } from '../services/db';
import { loadLightHistory, updateHistoryRecord } from '../services/historyRecords';
import { HistoryItem } from '../types';
import { useHistoryStore } from './useHistoryStore';
import { useBroadcastSync, broadcastHistoryUpdate } from './useBroadcastSync';
import { scheduleGentleFirebasePull } from '../services/firebaseThrottledQueue';
import { filterHistoryItems, downloadHistoryBackup, restoreHistoryFromFile } from './history/historyUtils';
import { forgetHistoryTranscripts } from './history/useHistoryTranscript';
import { useTranscriptSearchIds } from './history/useTranscriptSearchIds';
import { uiText } from '../utils/uiText';

export const useHistory = (
  appLang: 'en' | 'bn',
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void,
  onHistoryItemDeleted: (id: string) => void
) => {
  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);
  const isLoadingHistory = useHistoryStore(state => state.isLoadingHistory);
  const setIsLoadingHistory = useHistoryStore(state => state.setIsLoadingHistory);
  const historyLimit = useHistoryStore(state => state.historyLimit);
  const setHistoryLimit = useHistoryStore(state => state.setHistoryLimit);
  const isHistoryFullscreen = useHistoryStore(state => state.isHistoryFullscreen);
  const setIsHistoryFullscreen = useHistoryStore(state => state.setIsHistoryFullscreen);
  const activeHistoryId = useHistoryStore(state => state.activeHistoryId);
  const setActiveHistoryId = useHistoryStore(state => state.setActiveHistoryId);
  const histSearch = useHistoryStore(state => state.histSearch);
  const setHistSearch = useHistoryStore(state => state.setHistSearch);
  const debouncedHistSearch = useHistoryStore(state => state.debouncedHistSearch);
  const setDebouncedHistSearch = useHistoryStore(state => state.setDebouncedHistSearch);
  const histDateFilter = useHistoryStore(state => state.histDateFilter);
  const setHistDateFilter = useHistoryStore(state => state.setHistDateFilter);
  const histSentimentFilter = useHistoryStore(state => state.histSentimentFilter);
  const setHistSentimentFilter = useHistoryStore(state => state.setHistSentimentFilter);
  const showFavoritesOnly = useHistoryStore(state => state.showFavoritesOnly);
  const setShowFavoritesOnly = useHistoryStore(state => state.setShowFavoritesOnly);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHistSearch(histSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [histSearch, setDebouncedHistSearch]);

  const updateSessionCache = useCallback((items: HistoryItem[]) => {
    setTimeout(() => {
      try {
        const lightHistory = items.slice(0, 30).map(h => ({
          id: h.id,
          fileName: h.fileName,
          date: h.date,
          duration: h.duration,
          isFavorite: h.isFavorite
        }));
        sessionStorage.setItem('historyCache', JSON.stringify(lightHistory));
      } catch (e) {
        // Ignore quota exceeded
      }
    }, 0);
  }, []);

  const loadHistory = useCallback(async () => {
    const currentLen = useHistoryStore.getState().history.length;
    if (currentLen === 0) {
      setIsLoadingHistory(true);
    }
    try {
      // Light items only: transcripts stay in IndexedDB and are read when needed
      const allHistory = await loadLightHistory();
      forgetHistoryTranscripts();
      const sorted = allHistory.sort((a: HistoryItem, b: HistoryItem) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(sorted);
      updateSessionCache(sorted);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [setHistory, setIsLoadingHistory, updateSessionCache]);

  // Gently check Firebase once 4 seconds after startup and merge any missing cloud records in small chunks
  useEffect(() => {
    scheduleGentleFirebasePull(() => {
      loadHistory();
    }, false);
  }, [loadHistory]);

  useBroadcastSync(loadHistory);

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    const wasActive = useHistoryStore.getState().activeHistoryId === id;

    // 1. Optimistically remove only the deleted item in-memory so remaining items keep their exact object references
    const current = useHistoryStore.getState().history;
    const next = current.filter(item => item.id !== id);
    setHistory(next);
    updateSessionCache(next);

    if (wasActive) {
      setActiveHistoryId(null);
      onHistoryItemDeleted(id);
    }
    addToast(uiText(appLang, 'deleted'), 'warning');

    // 2. Perform IndexedDB & background sync deletion asynchronously off the critical UI path
    setTimeout(async () => {
      try {
        await deleteFromStore(STORES.HISTORY, id);
        deleteFromStore(STORES.YOUTUBE_AUDIO, id).catch(() => {});
        broadcastHistoryUpdate();
      } catch (e) {
        console.error("Failed to delete history item from store", e);
      }
    }, 0);
  }, [appLang, addToast, onHistoryItemDeleted, setActiveHistoryId, setHistory, updateSessionCache]);

  const toggleFavorite = useCallback(async (id: string) => {
    const currentHistory = useHistoryStore.getState().history;
    const item = currentHistory.find(h => h.id === id);
    if (item) {
      const updatedItem = { ...item, isFavorite: !item.isFavorite };
      const next = currentHistory.map(h => h.id === id ? updatedItem : h);
      setHistory(next);
      updateSessionCache(next);
      addToast(
        updatedItem.isFavorite 
          ? (uiText(appLang, 'addedToFavorites')) 
          : (uiText(appLang, 'removedFromFavorites')), 
        'success'
      );
      await updateHistoryRecord(id, { isFavorite: updatedItem.isFavorite });
      broadcastHistoryUpdate();
    }
  }, [appLang, addToast, setHistory, updateSessionCache]);

  const backupHistory = async () => {
    // Full records (with transcripts) are read from IndexedDB, in the same order as the list
    try {
      const order = new Map(history.map((h, i) => [h.id, i]));
      const records = (await getAllFromStore(STORES.HISTORY)) as HistoryItem[];
      downloadHistoryBackup(records.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)));
      addToast(uiText(appLang, 'backupDownloadStarted'), 'info');
    } catch (e) {
      console.error("Failed to back up history", e);
      addToast(uiText(appLang, 'failedToBackUpHistory'), 'error');
    }
  };

  const restoreHistory = async (file: File) => {
    try {
      await restoreHistoryFromFile(file);
      broadcastHistoryUpdate();
      loadHistory();
      addToast(uiText(appLang, 'historyRestoredSuccessfully'), 'success');
    } catch (e) {
      console.error("Failed to restore history", e);
      addToast(uiText(appLang, 'failedToRestoreHistory'), 'error');
    }
  };

  const transcriptMatchIds = useTranscriptSearchIds(debouncedHistSearch, history.length);
  const filteredHistory = useMemo(
    () => filterHistoryItems(history, { search: debouncedHistSearch, date: histDateFilter, favoritesOnly: showFavoritesOnly, sentiment: histSentimentFilter }, transcriptMatchIds),
    [history, debouncedHistSearch, histDateFilter, showFavoritesOnly, histSentimentFilter, transcriptMatchIds]
  );

  return {
    history,
    historyLimit, setHistoryLimit,
    isHistoryFullscreen, setIsHistoryFullscreen,
    activeHistoryId, setActiveHistoryId,
    histSearch, setHistSearch,
    histDateFilter, setHistDateFilter,
    histSentimentFilter, setHistSentimentFilter,
    showFavoritesOnly, setShowFavoritesOnly,
    loadHistory,
    handleDeleteHistoryItem,
    toggleFavorite,
    backupHistory,
    restoreHistory,
    filteredHistory,
    isLoadingHistory
  };
};
