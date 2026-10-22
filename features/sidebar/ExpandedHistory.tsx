import React from 'react';
import { useExpandedHistory } from './hooks/useExpandedHistory';
import { ExpandedHistoryHeader } from './components/ExpandedHistoryHeader';
import { ExpandedHistoryCard } from './components/ExpandedHistoryCard';

interface ExpandedHistoryProps {
  t: any;
  isDark: boolean;
  setIsHistoryFullscreen: (v: boolean) => void;
  histSearch: string;
  setHistSearch: (v: string) => void;
  histDateFilter: string;
  setHistDateFilter: (v: string) => void;
  histSentimentFilter: string;
  setHistSentimentFilter: (v: string) => void;
  filteredHistory: any[];
  historyLimit: number;
  setHistoryLimit: React.Dispatch<React.SetStateAction<number>>;
  loadHistoryItem: (item: any, searchKeyword?: string) => void;
  activeColors: any;
}

export const ExpandedHistory: React.FC<ExpandedHistoryProps> = ({
  t, isDark, setIsHistoryFullscreen, histSearch, setHistSearch,
  histDateFilter, setHistDateFilter, histSentimentFilter, setHistSentimentFilter, filteredHistory,
  historyLimit, setHistoryLimit, loadHistoryItem, activeColors
}) => {
  const {
    hoveredCardId,
    setHoveredCardId,
    isHistoryLoading,
    bottomRef,
    getSensitiveMatches,
    formatProcessingTime
  } = useExpandedHistory(filteredHistory, historyLimit, setHistoryLimit);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
      <div className={`w-[96vw] h-[94vh] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] border overflow-hidden flex flex-col ${isDark ? 'bg-slate-900 border-white/20' : 'bg-white border-white/20'}`}>
        
        {/* Expanded Header with Dynamic Theme Glass Effect */}
        <ExpandedHistoryHeader
          t={t}
          activeColors={activeColors}
          itemCount={filteredHistory.length}
          histSearch={histSearch}
          setHistSearch={setHistSearch}
          histDateFilter={histDateFilter}
          setHistDateFilter={setHistDateFilter}
          histSentimentFilter={histSentimentFilter}
          setHistSentimentFilter={setHistSentimentFilter}
          onClose={() => setIsHistoryFullscreen(false)}
        />
        
        <div className={`flex-1 overflow-y-auto custom-scrollbar p-12 ${isDark ? 'bg-slate-800' : 'bg-[#F1F3F5]'}`}>
           {filteredHistory.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center opacity-20 group/empty">
                <svg className="w-40 h-40 mb-8 transition-all duration-1000 group-hover/empty:scale-110 group-hover/empty:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 01-7 7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                <p className="text-3xl font-black uppercase tracking-widest">No Results Found</p>
             </div>
           ) : (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 relative z-10">
                {filteredHistory.slice(0, historyLimit).map((item, idx) => (
                  <ExpandedHistoryCard
                    key={item.id ? `${item.id}-${idx}` : `hist-exp-${idx}`}
                    item={item}
                    t={t}
                    isDark={isDark}
                    activeColors={activeColors}
                    sensitiveMatches={getSensitiveMatches(item.id)}
                    hoveredCardId={hoveredCardId}
                    setHoveredCardId={setHoveredCardId}
                    loadHistoryItem={loadHistoryItem}
                    formatProcessingTime={formatProcessingTime}
                  />
                ))}
             </div>
             
             {/* Lazy Loading Indicator */}
             {isHistoryLoading && historyLimit < filteredHistory.length && (
               <div className="flex justify-center items-center py-12 animate-in fade-in duration-300 col-span-full">
                 <div className={`flex items-center gap-3 px-6 py-3 rounded-full ${isDark ? 'bg-slate-800/80 border-white/10' : 'bg-white border-slate-200'} border shadow-xl`}>
                   <div className={`w-5 h-5 rounded-full border-2 ${activeColors.border} border-t-transparent animate-spin`}></div>
                   <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} tracking-widest uppercase`}>
                     {t.history === 'ইতিহাস' ? 'আরও লোড হচ্ছে...' : 'Loading more...'}
                   </span>
                 </div>
               </div>
             )}
             
             <div ref={bottomRef} style={{ height: '20px' }}></div>
           </>
           )}
        </div>
      </div>
    </div>
  );
};
