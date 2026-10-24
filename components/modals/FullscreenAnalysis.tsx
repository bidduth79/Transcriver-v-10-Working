
import React from 'react';
import { createPortal } from 'react-dom';
import type { ActiveColors } from '../../hooks/useAppTheme';
import type { HistoryItem } from '../../types';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { MODAL_LAYER } from '../../constants/modalLayers';
import { uiText } from '../../utils/uiText';

interface FullscreenAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  transcript: string;
  isDark: boolean;
  activeColors: ActiveColors;
  appLang: 'bn' | 'en';
  renderFormattedTranscript: (text: string) => React.ReactNode;
  loadHistoryItem: (item: HistoryItem) => void;
}

export const FullscreenAnalysis: React.FC<FullscreenAnalysisProps> = ({ 
  isOpen, onClose, history = [], transcript, isDark, activeColors, appLang, renderFormattedTranscript, loadHistoryItem 
}) => {
  const { dialogProps } = useModalBehavior(isOpen, onClose);
  if (!isOpen) return null;

  // Rendered on <body>: inside the main content (z-10) the app sidebar would cover its history panel
  return createPortal(
    <div {...dialogProps} className={`fixed inset-0 ${MODAL_LAYER.view} flex bg-slate-950 animate-in fade-in duration-500 overflow-hidden outline-none`}>
      {/* Sidebar - Full History */}
      <aside className={`w-[400px] lg:w-[480px] flex flex-col border-r border-white/10 ${isDark ? 'bg-slate-900' : 'bg-slate-900'}`}>
        <header className="p-10 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight font-stylish-bn">{uiText(appLang, 'mainHistory')}</h2>
            <div className="px-4 py-1.5 bg-white/10 rounded-full text-[11px] font-black text-white/70 border border-white/5 shadow-inner">
              {history?.length || 0} FILES
            </div>
          </div>
          <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bn:tracking-normal">{uiText(appLang, 'fullTranscriptArchive')}</p>
        </header>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-5 bg-black/10">
          {!history || history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-white p-10 text-center">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-xs font-black uppercase tracking-widest bn:tracking-normal leading-loose">{uiText(appLang, 'noPastTranscripts')}</p>
            </div>
          ) : (
            history.map(item => (
              <div 
                key={item.id} 
                onClick={() => loadHistoryItem(item)}
                className={`p-8 rounded-[2.5rem] border border-white/10 cursor-pointer transition-all hover:bg-white/5 hover:scale-[1.03] active:scale-[0.98] group ${isDark ? 'bg-white/5' : 'bg-slate-800/20'}`}
              >
                <p className="text-sm font-black text-white mb-3 line-clamp-1 font-stylish-bn group-hover:text-indigo-400 transition-colors uppercase">{item.fileName}</p>
                <div className="flex items-center justify-between opacity-40 text-[10px] font-black uppercase tracking-[0.15em] bn:tracking-normal">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>{item.duration || (item.timeTaken as string | undefined)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content - Full Transcript View */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        <header className="px-12 py-10 border-b border-white/10 flex items-center justify-between bg-slate-900/50 backdrop-blur-3xl z-10 shrink-0">
          <div className="flex items-center gap-8">
            <div className={`w-16 h-16 ${activeColors?.primary || 'bg-indigo-600'} rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10`}>
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight font-stylish-bn">{uiText(appLang, 'fullTranscriptPreview')}</h1>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] bn:tracking-normal mt-2">{uiText(appLang, 'reviewArchiveViewer')}</p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="flex items-center gap-5 bg-red-500/10 border border-red-500/20 text-red-500 px-10 py-5 rounded-[1.5rem] hover:bg-red-500 hover:text-white transition-all active:scale-95 group shadow-2xl"
          >
            <span className="text-xs font-black uppercase tracking-widest bn:tracking-normal">{uiText(appLang, 'close')}</span>
            <svg className="w-6 h-6 transition-transform group-hover:rotate-90 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-16 lg:p-28 bg-white/5 relative">
          <div className="max-w-5xl mx-auto">
            {!transcript ? (
              <div className="h-[60vh] flex flex-col items-center justify-center opacity-10 text-white text-center">
                <svg className="w-32 h-32 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p className="text-3xl font-black uppercase tracking-[0.4em] bn:tracking-normal">{uiText(appLang, 'transcriptNotLoaded')}</p>
                <p className="text-sm mt-4 font-bold uppercase tracking-widest bn:tracking-normal">{uiText(appLang, 'selectFileFromHistory')}</p>
              </div>
            ) : (
              <div className={`p-16 md:p-24 rounded-[4.5rem] border border-white/10 bg-slate-900/60 shadow-inner text-white backdrop-blur-sm animate-in zoom-in-95 duration-700`}>
                <div className="prose prose-invert max-w-none">
                  {renderFormattedTranscript(transcript)}
                </div>
              </div>
            )}
            <div className="h-48"></div>
          </div>
          {/* Decorative ambient light */}
          <div className={`absolute bottom-0 right-0 w-96 h-96 ${activeColors?.primary || 'bg-indigo-600'} opacity-[0.03] blur-[120px] rounded-full pointer-events-none`}></div>
        </div>
      </main>
    </div>,
    document.body
  );
};
