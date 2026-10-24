import React from 'react';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import { uiText } from '../../../utils/uiText';
import { useThemeStore } from '../../../hooks/useThemeStore';

interface Props {
  report: string;
  loading: boolean;
  searchTerm: string;
  isDark: boolean;
  activeColors: ActiveColors;
  onGenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

// Prompt → spinner → generated report with copy/download
export const ReportGenerateView = ({ report, loading, searchTerm, isDark, activeColors, onGenerate, onCopy, onDownload }: Props) => {
  const appLang = useThemeStore(state => state.appLang);
  return (
            <div className="flex-1 flex flex-col p-12 overflow-y-auto custom-scrollbar">
              {!report && !loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                  <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center opacity-30"><svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                  <div className="space-y-3">
                    <p className="text-xl font-black uppercase tracking-widest opacity-20">{uiText(appLang, 'clickToGenerateReport')}</p>
                    <p className="text-sm font-bold opacity-30 font-stylish-bn">{uiText(appLang, 'searchedTerm', { searchTerm })}</p>
                  </div>
                  <button onClick={onGenerate} className={`px-12 py-5 ${activeColors.primary} text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all`}>{uiText(appLang, 'generateReport')}</button>
                </div>
              ) : loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                  <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">{uiText(appLang, 'aiProcessing')}</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className={`p-12 rounded-[3rem] border shadow-inner whitespace-pre-wrap font-stylish-bn text-lg leading-relaxed ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                    {report}
                  </div>
                  <div className="flex justify-center gap-4">
                    <button onClick={onCopy} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-125 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>{uiText(appLang, 'copy')}</button>
                    <button onClick={onDownload} className={`flex items-center gap-3 px-8 py-4 ${activeColors.primary} text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 shadow-lg transition-all active:scale-95`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>{uiText(appLang, 'download2')}</button>
                  </div>
                </div>
              )}
            </div>
  );
};
