import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { useReportAnalysis } from './hooks/useReportAnalysis';
import { useReportActions, ReportItem } from './hooks/useReportActions';
import { useModalResize } from './hooks/useModalResize';
import { copyToClipboard } from '../../utils/clipboard';
import { ReportModalHeader } from './report/ReportModalHeader';
import { ReportGenerateView } from './report/ReportGenerateView';
import { ReportHistoryView } from './report/ReportHistoryView';
import type { ActiveColors } from '../../hooks/useAppTheme';
import type { FileMeta } from '../../types';
import type { ToastType } from '../../hooks/useToast';
import { uiText } from '../../utils/uiText';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { MODAL_LAYER, MODAL_BACKDROP } from '../../constants/modalLayers';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
  activeColors: ActiveColors;
  isDark: boolean;
  appLang: 'bn' | 'en';
  fileMeta: Partial<FileMeta>;
  searchTerm: string;
  addToast: (msg: string, type: ToastType) => void;
  onModelUpdate?: () => void;
  setIsAiLoading?: (loading: boolean) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ 
  isOpen, onClose, transcript, activeColors, isDark, appLang, fileMeta, searchTerm, addToast, onModelUpdate, setIsAiLoading
}) => {
  const [viewMode, setViewMode] = useState<'generate' | 'history'>('generate');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const { 
    report, 
    loading, 
    reportHistory, 
    loadReportsFromDB, 
    generateReport: generateReportAction, 
    handleDeleteReport: deleteReportAction 
  } = useReportActions(searchTerm, fileMeta, appLang, addToast, onModelUpdate, setIsAiLoading);

  // Resizing states with automatic cleanup on unmount
  const { size, isMinimized, setIsMinimized, isMaximized, setIsMaximized, startResizing } = useModalResize(900, 750, 'report-modal-container', 500, 400);

  const analysisData = useReportAnalysis(transcript, searchTerm, fileMeta);

  const matchCount = analysisData?.matchCount ?? 0;
  useEffect(() => {
    if (isOpen) {
      loadReportsFromDB();
      setIsMinimized(false);
      setViewMode(matchCount === 0 ? 'history' : 'generate');
    }
  }, [isOpen, matchCount, loadReportsFromDB, setIsMinimized]);

  const reportUpdates = useAppStore(state => state.storeUpdates['studio_reports']);
  useEffect(() => {
    if (isOpen) loadReportsFromDB();
  }, [reportUpdates, isOpen, loadReportsFromDB]);

  const generateReport = () => {
    generateReportAction(analysisData);
  };

  const handleCopy = async () => {
    const textToCopy = selectedReport ? selectedReport.content : report;
    if (!textToCopy) return;
    const success = await copyToClipboard(textToCopy);
    if (success) {
      addToast(uiText(appLang, 'copiedToClipboard'), 'success');
    } else {
      addToast(uiText(appLang, 'failedToCopy'), 'error');
    }
  };

  const handleDownload = () => {
    const textToDownload = selectedReport ? selectedReport.content : report;
    if (!textToDownload) return;
    
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = selectedReport ? selectedReport.searchTerm : searchTerm;
    link.download = `Report_${name}_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast(uiText(appLang, 'downloadStarted'), 'success');
  };

  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteReportAction(id, selectedReport, setSelectedReport);
  };

  const { dialogProps, backdropProps } = useModalBehavior(isOpen && !isMinimized, onClose);
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
            <span className="text-xs font-bold uppercase tracking-widest bn:tracking-normal">{uiText(appLang, 'report')}</span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
         </div>
      </div>

      {/* Full Modal - Hidden via CSS when minimized */}
      <div className={`fixed inset-0 ${MODAL_LAYER.panel} flex items-center justify-center p-0 ${MODAL_BACKDROP} animate-in fade-in duration-300 ${isMinimized ? 'hidden' : 'flex'}`} {...backdropProps}>
      <div 
        id="report-modal-container"
        {...dialogProps}
        className={`rounded-[4rem] border shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] flex flex-col relative animate-in zoom-in-95 duration-500 overflow-hidden outline-none ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
        style={{ 
            width: isMaximized ? '100vw' : `${size.width}px`, 
            height: isMaximized ? '100vh' : `${size.height}px`,
            maxWidth: isMaximized ? '100vw' : '95vw', 
            maxHeight: isMaximized ? '100vh' : '95vh',
            borderRadius: isMaximized ? '0' : '4rem'
        }}
        onClick={e => e.stopPropagation()}
      >
        
        <ReportModalHeader
          activeColors={activeColors}
          viewMode={viewMode}
          historyCount={reportHistory.length}
          onSelectView={(mode) => { setViewMode(mode); setSelectedReport(null); }}
          setIsMinimized={setIsMinimized}
          isMaximized={isMaximized}
          setIsMaximized={setIsMaximized}
          onClose={onClose}
          closeLabel={uiText(appLang, 'close')}
        />

        <div className="flex-1 flex overflow-hidden">
          {viewMode === 'generate' ? (
            <ReportGenerateView
              report={report}
              loading={loading}
              searchTerm={searchTerm}
              isDark={isDark}
              activeColors={activeColors}
              onGenerate={generateReport}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          ) : (
            <ReportHistoryView
              reportHistory={reportHistory}
              selectedReport={selectedReport}
              setSelectedReport={setSelectedReport}
              isDark={isDark}
              activeColors={activeColors}
              onDelete={handleDeleteReport}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          )}
        </div>

        {/* Resize Handle */}
        {!isMaximized && (
            <div 
            onMouseDown={startResizing}
            className="absolute bottom-4 right-4 w-12 h-12 cursor-nwse-resize flex items-center justify-center opacity-20 hover:opacity-100 transition-opacity z-[200]"
            >
            <svg className="w-8 h-8 text-slate-400 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 22h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm8-8h-2v-2h2v2zm-12 8h-2v-2h2v2z"/>
            </svg>
            </div>
        )}
      </div>
      </div>
    </>
  );
};
