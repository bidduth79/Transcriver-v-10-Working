import React, { memo, useMemo } from 'react';
import { useHistoryItemCard } from './hooks/useHistoryItemCard';
import { useHistoryTranscript } from '../../hooks/history/useHistoryTranscript';
import { getHistoryCardClass } from './utils/historyCardClass';
import { HoldToDeleteProgress } from './components/HoldToDeleteProgress';
import { SensitiveMatchBadge } from './components/SensitiveMatchBadge';
import { HistoryCardStatsRow } from './components/HistoryCardStatsRow';

export const HistoryItemCard = memo(({ 
  item, 
  activeHistoryId, 
  loadHistoryItem, 
  onDeleteHistoryItem, 
  isDark, 
  activeColors, 
  appLang, 
  getSensitiveMatches,
  isDuplicate,
  toggleFavorite
}: any) => {
  // Saved transcripts are read from IndexedDB only for cards that are rendered
  const transcript = useHistoryTranscript(item.id, !!getSensitiveMatches, item.transcript);
  const sensitiveMatches = useMemo(
    () => (getSensitiveMatches ? getSensitiveMatches(transcript) : []),
    [transcript, getSensitiveMatches]
  );
  const isSensitive = sensitiveMatches && sensitiveMatches.length > 0;
  const isActive = activeHistoryId === item.id;

  const formattedTime = useMemo(() => {
    try {
      return new Date(item.date).toLocaleTimeString(appLang === 'bn' ? 'bn-BD' : 'en-US', { timeStyle: 'short' });
    } catch {
      return '';
    }
  }, [item.date, appLang]);
  
  const {
    isPressing,
    handleStart,
    handleMove,
    handleEnd,
    handleClick,
    handleTouchEnd,
    formatProcessingTime
  } = useHistoryItemCard(item, onDeleteHistoryItem, loadHistoryItem);

  const itemClass = getHistoryCardClass({ isPressing, isActive, isDuplicate, isSensitive, isDark });

  return (
    <div 
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchCancel={handleEnd}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={`p-4 border rounded-2xl transition-colors duration-200 group relative cursor-pointer shadow-sm hover:shadow-xl select-none overflow-hidden ${itemClass}`}
    >
      {/* Smooth GPU-accelerated 3-second hold-to-delete progress bar */}
      {isPressing && <HoldToDeleteProgress />}

      <div className="mb-2 flex justify-between items-start gap-2 relative z-10">
          <p className={`text-[11px] font-bold ${isPressing ? 'text-red-400' : isActive ? (isDark ? 'text-green-400' : 'text-green-800') : (isDark ? 'text-white/90' : 'text-slate-700')} truncate font-stylish-bn transition-colors group-hover:text-indigo-500`}>
            {item.fileName?.replace(/_/g, ' ').replace(/#/g, '').replace(/\s+/g, ' ').trim()}
          </p>
          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (toggleFavorite) toggleFavorite(item.id);
            }}
            className={`p-1 shrink-0 rounded-full transition-colors ${item.isFavorite ? 'text-amber-400' : 'text-slate-400/50 hover:text-amber-400'}`}
          >
            <svg className="w-4 h-4" fill={item.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
      </div>
      
      <div className={`flex flex-col gap-2 text-[9px] relative z-10 ${isActive ? (isDark ? 'text-green-200/60' : 'text-green-700/60') : (isDark ? 'text-white/40' : 'text-slate-400')} font-black uppercase tracking-wider`}>
        {/* Date & Time Row */}
        <div className="flex items-center justify-between w-full" title="Creation Date">
            <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>{formattedTime}</span>
                {item.hasBeenOpened && (
                  <span title={appLang === 'bn' ? "ইতিপূর্বে খোলা হয়েছে" : "Previously Opened"}>
                    <svg className={`w-3 h-3 ml-0.5 ${isActive ? (isDark ? 'text-green-400' : 'text-green-600') : 'text-indigo-400/70 group-hover:text-indigo-500'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </span>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                {isPressing && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider bg-red-500 text-white animate-pulse">
                        {appLang === 'bn' ? 'ডিলিট হচ্ছে...' : 'DELETING...'}
                    </span>
                )}
                {!isPressing && isDuplicate && (
                    <span className={`shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                        DUPLICATE
                    </span>
                )}
                {!isPressing && isActive && (
                   <span className={`shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                       LOADED
                   </span>
                )}
                {!isPressing && isSensitive && !isActive && (
                    <SensitiveMatchBadge item={item} sensitiveMatches={sensitiveMatches} loadHistoryItem={loadHistoryItem} />
                )}
            </div>
        </div>
        
        <HistoryCardStatsRow item={item} isActive={isActive} isDark={isDark} activeColors={activeColors} formatProcessingTime={formatProcessingTime} />
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item === next.item &&
    (prev.activeHistoryId === prev.item?.id) === (next.activeHistoryId === next.item?.id) &&
    prev.isDuplicate === next.isDuplicate &&
    prev.isDark === next.isDark &&
    prev.appLang === next.appLang &&
    prev.getSensitiveMatches === next.getSensitiveMatches &&
    prev.activeColors === next.activeColors
  );
});
