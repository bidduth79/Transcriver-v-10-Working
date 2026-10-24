import React from 'react';
import type { ReportItem } from '../hooks/useReportActions';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import { uiText } from '../../../utils/uiText';
import { useThemeStore } from '../../../hooks/useThemeStore';

interface Props {
  reportHistory: ReportItem[];
  selectedReport: ReportItem | null;
  setSelectedReport: (r: ReportItem) => void;
  isDark: boolean;
  activeColors: ActiveColors;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onCopy: () => void;
  onDownload: () => void;
}

// Saved reports list with the selected report's text and actions
export const ReportHistoryView = ({ reportHistory, selectedReport, setSelectedReport, isDark, activeColors, onDelete, onCopy, onDownload }: Props) => {
  const appLang = useThemeStore(state => state.appLang);
  return (
            <div className="flex-1 flex overflow-hidden">
               <div className="w-1/3 border-r border-white/5 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-black/5">
                 {reportHistory.length === 0 ? (
                   <p className="text-center py-20 opacity-20 uppercase font-black text-[10px]">{uiText(appLang, 'empty')}</p>
                 ) : (
                   reportHistory.map(item => (
                     <div key={item.id} onClick={() => setSelectedReport(item)} className={`p-6 rounded-3xl border transition-all cursor-pointer group relative ${selectedReport?.id === item.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                       <p className="text-xs font-black uppercase tracking-tight mb-2 truncate">{item.searchTerm}</p>
                       <p className={`text-[10px] opacity-40 tabular-nums ${selectedReport?.id === item.id ? 'text-white' : ''}`}>{new Date(item.date).toLocaleDateString()}</p>
                       <button onClick={(e) => onDelete(e, item.id)} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                     </div>
                   ))
                 )}
               </div>
               <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                  {selectedReport ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className={`p-12 rounded-[3rem] border shadow-inner whitespace-pre-wrap font-stylish-bn text-lg leading-relaxed ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                        {selectedReport.content}
                      </div>
                      <div className="flex justify-center gap-4">
                        <button onClick={onCopy} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest bn:tracking-normal hover:brightness-125 transition-all">{uiText(appLang, 'copy')}</button>
                        <button onClick={onDownload} className={`flex items-center gap-3 px-8 py-4 ${activeColors.primary} text-white rounded-2xl text-[11px] font-black uppercase tracking-widest bn:tracking-normal hover:brightness-110 shadow-lg transition-all active:scale-95`}>{uiText(appLang, 'download2')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-10 uppercase font-black tracking-[0.4em] bn:tracking-normal">{uiText(appLang, 'selectReport')}</div>
                  )}
               </div>
            </div>
  );
};
