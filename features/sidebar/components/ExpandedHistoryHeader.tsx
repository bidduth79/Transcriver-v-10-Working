import React from 'react';
import type { Translations } from '../../../translations';
import type { ActiveColors } from '../../../hooks/useAppTheme';

interface Props {
  t: Translations;
  activeColors: ActiveColors;
  itemCount: number;
  histSearch: string;
  setHistSearch: (v: string) => void;
  histDateFilter: string;
  setHistDateFilter: (v: string) => void;
  histSentimentFilter: string;
  setHistSentimentFilter: (v: string) => void;
  onClose: () => void;
}

// Title with item count, search box, date and sentiment filters, close button
export const ExpandedHistoryHeader = ({
  t, activeColors, itemCount, histSearch, setHistSearch, histDateFilter, setHistDateFilter,
  histSentimentFilter, setHistSentimentFilter, onClose
}: Props) => (
        <header className="px-10 py-8 bg-slate-950/95 backdrop-blur-3xl border-b border-white/10 flex flex-wrap items-center justify-between shrink-0 gap-6 shadow-2xl z-10 relative">
          <div className="flex items-center gap-6 group cursor-default">
            <div className={`w-16 h-16 ${activeColors.primary} rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-black/40 ring-1 ring-white/20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6`}>
              <svg className="w-8 h-8 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white uppercase tracking-wider leading-none font-stylish-bn group-hover:text-white transition-colors text-white/90">{t.history}</h2>
              <p className={`text-[10px] font-black ${activeColors.text.replace('text-', 'text-opacity-80 text-')} tracking-[0.3em] uppercase`}>{itemCount} {t.itemsLogged}</p>
            </div>
          </div>

          <div className="flex-1 max-w-2xl flex items-center justify-end gap-4">
            {/* Stable History Search Bar */}
            <div 
              className={`relative flex items-center bg-white/5 border border-white/10 rounded-full p-1.5 transition-all duration-300 shadow-inner w-full max-w-[400px] focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-white/10 group/search`}
            >
               <div className={`w-9 h-9 flex items-center justify-center shrink-0 transition-all duration-300 group-hover/search:scale-125 ${histSearch ? activeColors.text : 'text-white/40'}`}>
                  <svg className="w-5 h-5 transition-transform group-hover/search:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
               <input 
                type="text" 
                placeholder={t.searchHist}
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-bold text-white placeholder:text-white/20 flex-1 px-3"
               />
               {histSearch && (
                 <button onClick={() => setHistSearch('')} className="p-1.5 bg-white/10 rounded-full text-white/40 hover:text-white transition-all mr-1 hover:scale-125 hover:rotate-90">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
               )}
            </div>

            <div className="w-48 relative group/date">
               <input 
                type="date" 
                value={histDateFilter}
                onChange={(e) => setHistDateFilter(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-full py-4 px-6 text-xs font-bold text-white outline-none focus:ring-4 ${activeColors.ring.replace('ring-', 'ring-opacity-20 ring-')} transition-all color-scheme-dark shadow-inner cursor-pointer group-hover/date:bg-white/10`}
               />
            </div>

            <div className="w-40 relative group/sentiment">
              <select
                value={histSentimentFilter}
                onChange={(e) => setHistSentimentFilter(e.target.value)}
                className={`w-full appearance-none bg-white/5 border border-white/10 rounded-full py-4 px-6 pr-10 text-xs font-bold text-white outline-none focus:ring-4 ${activeColors.ring.replace('ring-', 'ring-opacity-20 ring-')} transition-all shadow-inner cursor-pointer group-hover/sentiment:bg-white/10`}
              >
                <option value="All" className="bg-slate-900">All</option>
                <option value="Positive" className="bg-slate-900 text-green-400">Positive</option>
                <option value="Negative" className="bg-slate-900 text-red-400">Negative</option>
                <option value="Neutral" className="bg-slate-900 text-yellow-400">Neutral</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className={`group flex items-center gap-4 ${activeColors.primary} hover:brightness-110 text-white px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-xl border border-white/10`}
          >
            <span className="text-xs font-black uppercase tracking-widest">{t.close}</span>
            <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180 group-hover:scale-150" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
);
