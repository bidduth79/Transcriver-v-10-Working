import React, { useEffect } from 'react';
import { useModalResize } from './hooks/useModalResize';
import { useActivityLogs } from './activityLogs/useActivityLogs';
import { ActivityLogFilters } from './activityLogs/ActivityLogFilters';
import { ActivityLogList } from './activityLogs/ActivityLogList';
import type { ActiveColors } from '../../hooks/useAppTheme';
import { uiText } from '../../utils/uiText';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { MODAL_LAYER, MODAL_BACKDROP } from '../../constants/modalLayers';

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  activeColors: ActiveColors;
  appLang: 'bn' | 'en';
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({ isOpen, onClose, isDark, activeColors, appLang }) => {
  const { size, isMinimized, setIsMinimized, isMaximized, setIsMaximized, startResizing } =
    useModalResize(1000, 750, 'logs-modal-container', 600, 500);
  const logsState = useActivityLogs(isOpen);
  const { dialogProps, backdropProps } = useModalBehavior(isOpen && !isMinimized, onClose);

  useEffect(() => {
    if (isOpen) setIsMinimized(false);
  }, [isOpen, setIsMinimized]);

  if (!isOpen) return null;

  return (
    <>
      {/* Minimized Floating Widget */}
      <div className={`fixed bottom-24 right-20 ${MODAL_LAYER.minimized} animate-in slide-in-from-bottom-10 fade-in duration-300 ${isMinimized ? 'block' : 'hidden'}`}>
         <div
           onClick={() => setIsMinimized(false)}
           className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border cursor-pointer hover:scale-105 transition-transform ${isDark ? 'bg-slate-900 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
         >
            <div className={`w-3 h-3 rounded-full ${activeColors.primary}`}></div>
            <span className="text-xs font-bold uppercase tracking-widest">{uiText(appLang, 'logs')}</span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
         </div>
      </div>

      {/* Full Modal - Hidden via CSS when minimized */}
      <div className={`fixed inset-0 ${MODAL_LAYER.panel} flex items-center justify-center p-0 ${MODAL_BACKDROP} animate-in fade-in duration-300 ${isMinimized ? 'hidden' : 'flex'}`} {...backdropProps}>
      <div
        id="logs-modal-container"
        {...dialogProps}
        className={`rounded-[3rem] border shadow-2xl overflow-hidden flex flex-col relative outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        style={{
            width: isMaximized ? '100vw' : `${size.width}px`,
            height: isMaximized ? '100vh' : `${size.height}px`,
            maxWidth: isMaximized ? '100vw' : '95vw',
            maxHeight: isMaximized ? '100vh' : '95vh',
            borderRadius: isMaximized ? '0' : '3rem'
        }}
      >

        {/* Header */}
        <header className="px-10 py-6 bg-slate-900 text-white flex items-center justify-between shrink-0 cursor-move">
          <div className="flex items-center gap-5 group">
            <div className={`w-14 h-14 ${activeColors.primary} rounded-2xl flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
               <svg className="w-7 h-7 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight font-stylish-bn transition-colors group-hover:text-white/90">{uiText(appLang, 'activityMonitor')}</h2>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">SYSTEM LOGS & DIAGNOSTICS</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsMinimized(true)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5 group">
                <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4"/></svg>
            </button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5 group">
                <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4"/></svg>
            </button>
            <button onClick={onClose} aria-label={uiText(appLang, 'close')} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/10 group">
                <svg className="w-6 h-6 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <ActivityLogFilters state={logsState} isDark={isDark} />
        <ActivityLogList state={logsState} isDark={isDark} />

        {/* Resize Handle */}
        {!isMaximized && (
            <div
            onMouseDown={startResizing}
            className="absolute bottom-2 right-2 w-10 h-10 cursor-nwse-resize flex items-center justify-center opacity-20 hover:opacity-100 transition-opacity z-[200]"
            >
            <svg className="w-6 h-6 text-slate-400 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 22h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm8-8h-2v-2h2v2zm-12 8h-2v-2h2v2z"/>
            </svg>
            </div>
        )}
      </div>
      </div>
    </>
  );
};
