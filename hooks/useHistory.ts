import { useEffect, useCallback, useMemo } from 'react';
import { getAllFromStore, deleteFromStore, addToStore, STORES } from '../services/db';
import { HistoryItem } from '../types';
import { useHistoryStore } from './useHistoryStore';
import { useBroadcastSync, broadcastHistoryUpdate } from './useBroadcastSync';
import { scheduleGentleFirebasePull } from '../services/firebaseThrottledQueue';

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
  }, [histSearch]);

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
      const allHistory = (await getAllFromStore(STORES.HISTORY)) as HistoryItem[];
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
    addToast(appLang === 'bn' ? 'ডিলিট করা হয়েছে' : 'Deleted', 'warning');

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
          ? (appLang === 'bn' ? 'বুকমার্কে যোগ করা হয়েছে' : 'Added to favorites') 
          : (appLang === 'bn' ? 'বুকমার্ক থেকে সরানো হয়েছে' : 'Removed from favorites'), 
        'success'
      );
      await addToStore(STORES.HISTORY, updatedItem);
      broadcastHistoryUpdate();
    }
  }, [appLang, addToast, setHistory, updateSessionCache]);

  const backupHistory = () => {
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
    addToast(appLang === 'bn' ? 'ব্যাকআপ ডাউনলোড শুরু হয়েছে' : 'Backup download started', 'info');
  };

  const restoreHistory = async (file: File) => {
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.id && item.date && item.transcript) {
            await addToStore(STORES.HISTORY, item);
          }
        }
        broadcastHistoryUpdate();
        loadHistory();
        addToast(appLang === 'bn' ? 'হিস্টোরি রিস্টোর সফল হয়েছে' : 'History restored successfully', 'success');
      } else {
        throw new Error("Invalid format");
      }
    } catch (e) {
      console.error("Failed to restore history", e);
      addToast(appLang === 'bn' ? 'রিস্টোর করতে সমস্যা হয়েছে' : 'Failed to restore history', 'error');
    }
  };

  const groupHistory = useCallback((items: HistoryItem[]) => {
    const groups: { [key: string]: HistoryItem[] } = {};
    if (Array.isArray(items)) {
      items.forEach(item => {
        const dateStr = item?.date ? new Date(item.date).toLocaleDateString() : 'Unknown';
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(item);
      });
    }
    return groups;
  }, []);

  const filteredHistory = useMemo(() => {
    if (!debouncedHistSearch && !histDateFilter && !showFavoritesOnly && histSentimentFilter === 'All') return history;
    const searchRegex = debouncedHistSearch.trim() ? new RegExp(debouncedHistSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    return history.filter(item => {
      let matchesSearch = true;
      if (searchRegex) {
        const rawFileName = item.fileName || '';
        const displayFileName = rawFileName.replace(/_/g, ' ').replace(/#/g, '').replace(/\s+/g, ' ').trim();
        matchesSearch = searchRegex.test(rawFileName) || 
                        searchRegex.test(displayFileName) || 
                        searchRegex.test(item.transcript || item.text || '');
      }
      const matchesDate = histDateFilter ? (item.date && typeof item.date === 'string' ? item.date.startsWith(histDateFilter) : false) : true;
      const matchesFavorite = showFavoritesOnly ? !!item?.isFavorite : true;
      const matchesSentiment = histSentimentFilter === 'All' ? true : item?.bgbRemark === histSentimentFilter;
      return matchesSearch && matchesDate && matchesFavorite && matchesSentiment;
    });
  }, [history, debouncedHistSearch, histDateFilter, showFavoritesOnly, histSentimentFilter]);

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
    groupHistory,
    filteredHistory,
    isLoadingHistory
  };
};
