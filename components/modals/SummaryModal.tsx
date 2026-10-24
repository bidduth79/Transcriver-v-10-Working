import React, { useState } from 'react';
import { SearchAnalysisItem } from '../../services/SearchAnalysisHistory';
import { useSummaryAnalysis, useSummaryStats } from './hooks/useSummaryLogic';
import { useModalResize } from './hooks/useModalResize';
import { SummaryLiveReport } from './summary/SummaryLiveReport';
import { SummaryHistoryList } from './summary/SummaryHistoryList';
import { SummaryModalHeader } from './summary/SummaryModalHeader';
import { useSummaryHistory } from './summary/useSummaryHistory';
import type { ActiveColors } from '../../hooks/useAppTheme';
import type { FileMeta } from '../../types';
import type { ToastType } from '../../hooks/useToast';
import { uiText } from '../../utils/uiText';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  activeColors: ActiveColors;
  isDark: boolean;
  appLang: 'bn' | 'en';
  searchTerm: string;
  fileMeta: Partial<FileMeta>;
  addToast: (msg: string, type: ToastType) => void;
  onModelUpdate?: () => void;
  setIsAiLoading?: (loading: boolean) => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen, onClose, transcript, activeColors, isDark, appLang, searchTerm, fileMeta, addToast, onModelUpdate, setIsAiLoading
}) => {
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SearchAnalysisItem | null>(null);

  const { aiAnalysis, setAiAnalysis, isAnalyzing, performAIAnalysis } = useSummaryAnalysis(searchTerm, transcript, appLang, addToast, setIsAiLoading, onModelUpdate);
  const currentStats = useSummaryStats(searchTerm, transcript, fileMeta);
  const { size, isMinimized, setIsMinimized, isMaximized, setIsMaximized, startResizing } = useModalResize(1000, 800, 'summary-modal-container');
  const { historyWithDuplicateFlags, confirmDelete } = useSummaryHistory({
    isOpen, searchTerm, transcript, currentStats, aiAnalysis, setAiAnalysis, isAnalyzing,
    setIsMinimized, setViewMode, appLang, addToast,
  });

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  if (!isOpen) return null;

  const reportProps = { viewMode, aiAnalysis, isAnalyzing, performAIAnalysis, activeColors, appLang, selectedHistoryItem, setSelectedHistoryItem };

  return (
    <>
      {/* Minimized Floating Widget - Visible when minimized */}
      <div className={`fixed bottom-24 right-20 z-[120] animate-in slide-in-from-bottom-10 fade-in duration-300 ${isMinimized ? 'block' : 'hidden'}`}>
         <div
           onClick={() => setIsMinimized(false)}
           className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border cursor-pointer hover:scale-105 transition-transform ${isDark ? 'bg-slate-900 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
         >
            <div className={`w-3 h-3 rounded-full ${activeColors.primary}`}></div>
            <span className="text-xs font-bold uppercase tracking-widest">{uiText(appLang, 'analysis')}</span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
         </div>
      </div>

      {/* Full Modal View - Hidden via CSS when minimized to keep state alive */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-0 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-300 ${isMinimized ? 'hidden' : 'flex'}`}
      >
      <div
        id="summary-modal-container"
        className={`rounded-[4.5rem] border shadow-[0_60px_150px_-20px_rgba(0,0,0,0.6)] flex flex-col relative animate-in zoom-in-95 duration-500 overflow-hidden ${isDark ? 'bg-slate-900 border-white/20' : 'bg-white border-slate-200'}`}
        style={{
            width: isMaximized ? '100vw' : `${size.width}px`,
            height: isMaximized ? '100vh' : `${size.height}px`,
            maxWidth: isMaximized ? '100vw' : '95vw',
            maxHeight: isMaximized ? '100vh' : '95vh',
            borderRadius: isMaximized ? '0' : '4.5rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SummaryModalHeader
          activeColors={activeColors}
          viewMode={viewMode}
          onSelectView={(mode) => { setViewMode(mode); setSelectedHistoryItem(null); }}
          onMinimize={() => setIsMinimized(true)}
          onToggleMaximize={() => setIsMaximized(!isMaximized)}
          onClose={handleClose}
        />

        <div className={`flex-1 overflow-y-auto overflow-x-visible custom-scrollbar p-14 lg:p-20 relative ${!isMaximized && 'rounded-b-[4.5rem]'}`}>
          {viewMode === 'current' ? (
            currentStats && currentStats.matchCount > 0 ? (
              <SummaryLiveReport data={currentStats} titleSuffix="LIVE ANALYSIS" {...reportProps} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 py-40 text-center animate-in fade-in">
                <div className="w-32 h-32 bg-slate-100 rounded-[3rem] flex items-center justify-center mb-10"><svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
                <p className="text-3xl font-black uppercase tracking-[0.3em]">ম্যাচ পাওয়া যায়নি</p>
              </div>
            )
          ) : (
            selectedHistoryItem ? (
              <SummaryLiveReport data={selectedHistoryItem} titleSuffix="ARCHIVED ANALYSIS" {...reportProps} />
            ) : (
              <SummaryHistoryList
                historyWithDuplicateFlags={historyWithDuplicateFlags}
                activeColors={activeColors}
                isDark={isDark}
                appLang={appLang}
                onDelete={confirmDelete}
                onSelect={setSelectedHistoryItem}
              />
            )
          )}
        </div>

        {/* Resize Handle */}
        {!isMaximized && (
            <div
            onMouseDown={startResizing}
            className="absolute bottom-4 right-4 w-12 h-12 cursor-nwse-resize flex items-center justify-center opacity-20 hover:opacity-100 transition-opacity z-[200]"
            >
            <svg className="w-8 h-8 text-slate-400 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 22h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm8-8h-2v-2h2v2zm-12 8h-2v-2h2v2z"/>
            </svg>
            </div>
        )}
      </div>
      </div>
    </>
  );
};
