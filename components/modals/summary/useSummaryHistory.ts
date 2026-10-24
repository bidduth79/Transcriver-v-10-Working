import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { SearchAnalysisItem, saveSearchAnalysis, getSearchAnalysisHistory, deleteSearchAnalysisAction } from '../../../services/SearchAnalysisHistory';
import { logSystemActivity } from '../../../services/SystemLogger';
import type { SummaryStats } from '../hooks/useSummaryLogic';
import type { AiAnalysis } from '../hooks/useSummaryLogic';
import type { ToastType } from '../../../hooks/useToast';

interface Options {
  isOpen: boolean;
  searchTerm: string;
  transcript: string;
  currentStats: SummaryStats | null;
  aiAnalysis: AiAnalysis | null;
  setAiAnalysis: (v: AiAnalysis | null) => void;
  isAnalyzing: boolean;
  setIsMinimized: (v: boolean) => void;
  setViewMode: (v: 'current' | 'history') => void;
  appLang: 'bn' | 'en';
  addToast: (msg: string, type: ToastType) => void;
}

// Saved search-analysis archive: loads on open/store updates, auto-saves live results, deletes items
export const useSummaryHistory = ({
  isOpen, searchTerm, transcript, currentStats, aiAnalysis, setAiAnalysis, isAnalyzing,
  setIsMinimized, setViewMode, appLang, addToast
}: Options) => {
  const [history, setHistory] = useState<SearchAnalysisItem[]>([]);

  const handleSave = async (forceUpdate: boolean = false) => {
    if (currentStats && currentStats.matchCount > 0) {
      const newItem: SearchAnalysisItem = {
        id: Date.now().toString(),
        searchTerm: currentStats.searchTerm,
        fileName: currentStats.fileName,
        duration: currentStats.duration,
        speakerCount: 0,
        matchCount: currentStats.matchCount,
        matchTimestamps: currentStats.matchTimestamps,
        matchSentences: currentStats.matchSentences,
        date: new Date().toISOString(),
        sentiment: aiAnalysis?.sentiment || 'pending',
        remarkExplanation: aiAnalysis?.remark || ''
      };

      const latestData = await getSearchAnalysisHistory();

      const existingIdx = latestData.findIndex(h =>
        h.fileName === newItem.fileName &&
        h.searchTerm === newItem.searchTerm &&
        h.matchCount === newItem.matchCount
      );

      if (existingIdx !== -1) {
        if (aiAnalysis && latestData[existingIdx].sentiment === 'pending') {
          newItem.id = latestData[existingIdx].id;
          newItem.date = latestData[existingIdx].date;
        } else if (!forceUpdate) {
          return;
        }
      }

      const updated = await saveSearchAnalysis(newItem);
      setHistory(updated);
    }
  };

  useEffect(() => {
    let saveTimer: number | null = null;
    const loadHistory = async () => {
      const data = await getSearchAnalysisHistory();
      setHistory(data);
    };
    if (isOpen) {
      loadHistory();
      setIsMinimized(false);
      if (!searchTerm || !transcript) {
        setViewMode('history');
      } else {
        setAiAnalysis(null);
        saveTimer = window.setTimeout(() => handleSave(false), 500);
      }
    }
    return () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }
    };
  }, [isOpen, searchTerm]);

  const analysisUpdates = useAppStore(state => state.storeUpdates['studio_analysis']);
  useEffect(() => {
    if (isOpen) {
       getSearchAnalysisHistory().then(setHistory);
    }
  }, [analysisUpdates, isOpen]);

  useEffect(() => {
    if (aiAnalysis && currentStats && !isAnalyzing) {
      handleSave(true);
    }
  }, [aiAnalysis]);

  const confirmDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = await deleteSearchAnalysisAction(id);
    setHistory(updated);
    logSystemActivity('ANALYSIS', 'WARNING', 'Analysis Deleted', `ID: ${id}`);
    addToast(appLang === 'bn' ? "ডিলিট করা হয়েছে" : "Deleted successfully", 'warning');
  };

  // Later entries for an already-listed file are marked as duplicates
  const historyWithDuplicateFlags = history.map((item, index, self) => {
    const isDuplicate = self.findIndex(t => t.fileName === item.fileName) !== index;
    return { ...item, isDuplicate };
  });

  return { historyWithDuplicateFlags, confirmDelete };
};
