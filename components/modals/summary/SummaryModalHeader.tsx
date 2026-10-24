import React from 'react';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import { uiText } from '../../../utils/uiText';
import { useThemeStore } from '../../../hooks/useThemeStore';

interface Props {
  activeColors: ActiveColors;
  viewMode: 'current' | 'history';
  onSelectView: (mode: 'current' | 'history') => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: (e?: React.MouseEvent) => void;
  closeLabel: string;
}

// Title, live/history tabs and window buttons
export const SummaryModalHeader = ({ activeColors, viewMode, onSelectView, onMinimize, onToggleMaximize, onClose, closeLabel }: Props) => {
  const appLang = useThemeStore(state => state.appLang);
  return (
        <header className="px-12 py-10 border-b border-white/10 flex items-center justify-between bg-slate-900 text-white shrink-0 relative z-[110] shadow-xl cursor-move">
          <div className="flex items-center gap-10">
            <div className={`w-20 h-20 ${activeColors?.primary || 'bg-indigo-600'} rounded-[2.5rem] flex items-center justify-center shadow-2xl ring-4 ring-white/10 transition-transform hover:rotate-3`}>
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight font-stylish-bn leading-none">{uiText(appLang, 'searchAnalysis')}</h2>
              <div className="flex gap-8 mt-5">
                <button onClick={() => onSelectView('current')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-2 border-b-2 transition-all ${viewMode === 'current' ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/60'}`}>{uiText(appLang, 'liveReport')}</button>
                <button onClick={() => onSelectView('history')} className={`text-[12px] font-black uppercase tracking-[0.3em] pb-2 border-b-2 transition-all ${viewMode === 'history' ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/60'}`}>{uiText(appLang, 'historyArchive')}</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onMinimize} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10 group">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4"/></svg>
            </button>
            <button onClick={onToggleMaximize} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10 group">
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4"/></svg>
            </button>
            <button
                onClick={onClose}
                aria-label={closeLabel}
                className="w-16 h-16 flex items-center justify-center bg-white/10 hover:bg-red-600 hover:text-white rounded-full transition-all text-white border border-white/20 active:scale-90 shadow-lg group"
            >
                <svg className="w-8 h-8 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>
  );
};
