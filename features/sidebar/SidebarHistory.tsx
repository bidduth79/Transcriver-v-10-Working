import React from 'react';
import { useHistoryListData } from './hooks/useHistoryListData';
import { SidebarHistoryHeader } from './components/SidebarHistoryHeader';
import { HistoryDatePicker } from './components/HistoryDatePicker';
import { HistorySentimentPicker } from './components/HistorySentimentPicker';
import { HistorySkeletonCard } from './components/HistorySkeletonCard';
import { VirtualHistoryRows } from './components/VirtualHistoryRows';

export const SidebarHistory = ({
  t,
  history,
  fullHistory,
  isLoadingHistory,
  setIsHistoryFullscreen,
  groupedHistory: initialGroupedHistory,
  cardBg,
  cardBorder,
  activeHistoryId,
  loadHistoryItem,
  onDeleteHistoryItem,
  isDark,
  activeColors,
  appLang,
  getSensitiveMatches,
  bottomRef,
  isHistoryLoading,
  scrollContainerEl,
  showFavoritesOnly,
  setShowFavoritesOnly,
  toggleFavorite,
  backupHistory,
  restoreHistory,
  histSentimentFilter,
  setHistSentimentFilter,
  totalHistoryCount
}: any) => {
  const list = useHistoryListData({ history, fullHistory, initialGroupedHistory, scrollContainerEl, activeHistoryId });
  const { isDatePickerOpen, isSentimentPickerOpen, setIsSentimentPickerOpen, isSearchOpen, searchQuery, setSearchQuery, processedGroupedHistory } = list;
  const cardProps = { activeHistoryId, loadHistoryItem, onDeleteHistoryItem, toggleFavorite, isDark, activeColors, appLang, getSensitiveMatches };

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4 pb-2 z-50 shrink-0 sticky top-0 bg-inherit">
        <SidebarHistoryHeader
          t={t}
          list={list}
          history={history}
          totalHistoryCount={totalHistoryCount}
          histSentimentFilter={histSentimentFilter}
          showFavoritesOnly={showFavoritesOnly}
          setShowFavoritesOnly={setShowFavoritesOnly}
          backupHistory={backupHistory}
          restoreHistory={restoreHistory}
          setIsHistoryFullscreen={setIsHistoryFullscreen}
        />

        {/* Pickers moved outside of overflow-hidden header */}
        {isDatePickerOpen && <HistoryDatePicker t={t} list={list} isDark={isDark} appLang={appLang} />}

        {isSentimentPickerOpen && (
          <HistorySentimentPicker
            isDark={isDark}
            histSentimentFilter={histSentimentFilter}
            setHistSentimentFilter={setHistSentimentFilter}
            onClose={() => setIsSentimentPickerOpen(false)}
          />
        )}

        {/* Search Input Expansion */}
        {isSearchOpen && (
          <div className="mb-2 w-full animate-in slide-in-from-top-2 fade-in duration-200">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchFilesText}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
            />
          </div>
        )}
      </div>

      {/* History content */}
      <div className="px-6 pb-6 pt-1 relative">
        {isLoadingHistory && (!history || history.length === 0) ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <HistorySkeletonCard key={i} isDark={isDark} />)}
          </div>
        ) : !history || history.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center opacity-30 text-slate-400 group cursor-default">
            <svg className="w-10 h-10 mb-2 transition-transform duration-700 group-hover:rotate-180 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[10px] font-bold uppercase tracking-widest">{t.empty}</p>
          </div>
        ) : Object.keys(processedGroupedHistory).length === 0 && searchQuery ? (
          <div className="h-40 flex flex-col items-center justify-center opacity-50 text-slate-400 group cursor-default">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="text-[10px] font-bold uppercase tracking-widest">{t.noResultsFound}</p>
          </div>
        ) : (
          <div className={`${cardBg} p-5 rounded-3xl border ${cardBorder} shadow-[0_30px_60px_rgba(0,0,0,0.25)] transition-all mb-4 relative`}>
            <VirtualHistoryRows list={list} activeColors={activeColors} cardProps={cardProps} />
          </div>
        )}
        <div ref={bottomRef} className="mt-2 flex flex-col gap-3 pb-4">
            {isHistoryLoading && <HistorySkeletonCard isDark={isDark} />}
        </div>
      </div>
    </div>
  );
};
