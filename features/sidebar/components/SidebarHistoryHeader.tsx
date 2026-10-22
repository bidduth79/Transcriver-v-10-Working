import React from 'react';
import type { HistoryListData } from '../hooks/useHistoryListData';

interface Props {
  t: any;
  list: HistoryListData;
  history: any[];
  totalHistoryCount?: number;
  histSentimentFilter: string;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (v: boolean) => void;
  backupHistory: () => void;
  restoreHistory?: (file: File) => void;
  setIsHistoryFullscreen: (v: boolean) => void;
}

export const SidebarHistoryHeader = ({
  t, list, history, totalHistoryCount, histSentimentFilter, showFavoritesOnly,
  setShowFavoritesOnly, backupHistory, restoreHistory, setIsHistoryFullscreen
}: Props) => {
  const {
    isDatePickerOpen, setIsDatePickerOpen,
    isSentimentPickerOpen, setIsSentimentPickerOpen,
    isSearchOpen, setIsSearchOpen,
  } = list;
  const restoreInputRef = React.useRef<HTMLInputElement>(null);

  return (
        <div className="flex items-center bg-slate-950 px-3 py-3 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.4)] border border-white/10 mb-2 h-[52px] relative cursor-default overflow-hidden">
          <div className="peer/dot flex items-center group/dot cursor-pointer py-2 pr-4 z-20 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] shrink-0 animate-pulse`}></div>
            <div className="flex items-center overflow-hidden transition-all duration-500 max-w-0 opacity-0 group-hover/dot:max-w-[250px] group-hover/dot:opacity-100 group-hover/dot:ml-2">
              <span className="text-[12px] font-black uppercase tracking-[0.15em] text-white whitespace-nowrap">{t.history}</span>
            </div>
          </div>

          <div className="transition-all duration-500 flex-1"></div>

          <div className="flex items-center gap-1 shrink-0 z-10 transition-transform duration-500">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/5 shrink-0 hidden sm:inline-block mr-1`}>{totalHistoryCount !== undefined ? totalHistoryCount : (history?.length || 0)}</span>

            <div className="static flex gap-1">
            <div className="static">
              <button
                onClick={(e) => { e.stopPropagation(); setIsDatePickerOpen(!isDatePickerOpen); setIsSentimentPickerOpen(false); setIsSearchOpen(false); }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all border shadow-inner shrink-0 cursor-pointer group ${isDatePickerOpen ? 'text-white bg-white/20 border-white/20' : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'}`}
                title={t.filterByDate}
              >
                <svg className="w-4 h-4 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            <div className="static">
              <button
                onClick={(e) => { e.stopPropagation(); setIsSentimentPickerOpen(!isSentimentPickerOpen); setIsDatePickerOpen(false); setIsSearchOpen(false); }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all border shadow-inner shrink-0 cursor-pointer ${isSentimentPickerOpen ? 'text-white bg-white/20 border-white/20' : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'} ${histSentimentFilter !== 'All' ? 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' : ''}`}
                title={t.sentimentFilter}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-1 border-r border-white/10 pr-1 mr-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowFavoritesOnly(!showFavoritesOnly); }}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all border shadow-inner shrink-0 cursor-pointer group ${showFavoritesOnly ? 'text-amber-400 bg-amber-400/20 border-amber-400/30' : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'}`}
              title={t.showFavoritesOnly}
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-125" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); backupHistory(); }}
              className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-green-400 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 shadow-inner shrink-0 cursor-pointer group"
              title={t.backup}
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (restoreInputRef.current) restoreInputRef.current.click();
              }}
              className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-indigo-400 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 shadow-inner shrink-0 cursor-pointer group"
              title={t.restore}
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <input
              type="file"
              ref={restoreInputRef}
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0] && restoreHistory) {
                  restoreHistory(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setIsSearchOpen(!isSearchOpen); setIsDatePickerOpen(false); }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all border shadow-inner shrink-0 cursor-pointer group ${isSearchOpen ? 'text-white bg-white/20 border-white/20' : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'}`}
            title={t.search}
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setIsHistoryFullscreen(true); }}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 shadow-inner shrink-0 group cursor-pointer"
            title={t.expand}
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          </div>
          <div className="transition-all duration-500 flex-1 peer-hover/dot:flex-none peer-hover/dot:w-0"></div>
        </div>
  );
};
