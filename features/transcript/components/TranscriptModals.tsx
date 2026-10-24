import React from 'react';
import { SummaryModal } from '../../../components/modals/SummaryModal';
import { ReportModal } from '../../../components/modals/ReportModal';
import { FullscreenAnalysis } from '../../../components/modals/FullscreenAnalysis';
import { SpeakerProfileSidebar } from '../../../components/modals/SpeakerProfileSidebar';

import { FileMeta, HistoryItem } from '../../../types';
import { loadHistoryTranscript } from '../../../hooks/history/useHistoryTranscript';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import type { ToastType } from '../../../hooks/useToast';
import type { SpeakerProfile } from '../../../types/speaker';
import type { SpeakerCustomNote } from '../../../types/speaker';
import type { FormattedTranscriptProps } from '../TranscriptViewer';

export interface TranscriptModalsProps {
  isSummaryOpen: boolean;
  setIsSummaryOpen: (isOpen: boolean) => void;
  isReportOpen: boolean;
  setIsReportOpen: (isOpen: boolean) => void;
  isAnalysisOpen: boolean;
  setIsAnalysisOpen: (isOpen: boolean) => void;
  isSpeakerProfileOpen: boolean;
  closeProfile: () => void;
  speakerName: string;
  speakerProfile: SpeakerProfile | null;
  isSpeakerLoading: boolean;
  speakerError: string | null;
  refreshProfile: (speakerId: string) => void;
  updateCustomNote: (note: SpeakerCustomNote) => void;
  transcript: string;
  activeColors: ActiveColors;
  isDark: boolean;
  appLang: 'bn' | 'en';
  searchTerm: string;
  matchCount: number;
  fileMeta: Partial<FileMeta>;
  addToast: (msg: string, type: ToastType) => void;
  onSeek: (time: string | number) => void;
  onModelUpdate: () => void;
  setIsAiLoading: (isLoading: boolean) => void;
  history: HistoryItem[];
  FormattedTranscript: React.ComponentType<FormattedTranscriptProps>;
  currentMatchIndex: number;
  sensitiveMatches: string[];
  openProfile: (speakerId: string) => void;
  setTranscript: (transcript: string) => void;
  setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void;
}

export const TranscriptModals: React.FC<TranscriptModalsProps> = ({
  isSummaryOpen,
  setIsSummaryOpen,
  isReportOpen,
  setIsReportOpen,
  isAnalysisOpen,
  setIsAnalysisOpen,
  isSpeakerProfileOpen,
  closeProfile,
  speakerName,
  speakerProfile,
  isSpeakerLoading,
  speakerError,
  refreshProfile,
  updateCustomNote,
  transcript,
  activeColors,
  isDark,
  appLang,
  searchTerm,
  matchCount,
  fileMeta,
  addToast,
  onSeek,
  onModelUpdate,
  setIsAiLoading,
  history,
  FormattedTranscript,
  currentMatchIndex,
  sensitiveMatches,
  openProfile,
  setTranscript,
  setStatus
}) => {
  return (
    <>
      {isSummaryOpen && (
        <SummaryModal 
          isOpen={isSummaryOpen} 
          onClose={() => setIsSummaryOpen(false)} 
          transcript={transcript} 
          activeColors={activeColors} 
          isDark={isDark} 
          appLang={appLang}
          searchTerm={searchTerm}
          fileMeta={fileMeta}
          addToast={addToast}
          onModelUpdate={onModelUpdate}
          setIsAiLoading={setIsAiLoading}
        />
      )}
      {isReportOpen && (
        <ReportModal 
          isOpen={isReportOpen} 
          onClose={() => setIsReportOpen(false)} 
          transcript={transcript} 
          activeColors={activeColors} 
          isDark={isDark} 
          appLang={appLang} 
          fileMeta={fileMeta}
          searchTerm={searchTerm}
          addToast={addToast}
          onModelUpdate={onModelUpdate}
          setIsAiLoading={setIsAiLoading}
        />
      )}
      {isAnalysisOpen && (
        <FullscreenAnalysis 
          isOpen={isAnalysisOpen}
          onClose={() => setIsAnalysisOpen(false)}
          history={history}
          transcript={transcript}
          isDark={isDark}
          activeColors={activeColors}
          appLang={appLang}
          renderFormattedTranscript={(text: string) => (
            <FormattedTranscript 
              text={text} 
              searchTerm={searchTerm} 
              isDark={isDark} 
              currentMatchIndex={currentMatchIndex} 
              sensitiveMatches={sensitiveMatches} 
              onSeek={onSeek} 
              onSpeakerClick={openProfile} 
            />
          )}
          loadHistoryItem={async (h) => {
            // List items are light; the saved transcript is read from IndexedDB
            setTranscript(h.transcript ?? await loadHistoryTranscript(h.id));
            setStatus('completed');
            setIsAnalysisOpen(false);
            addToast(appLang === 'bn' ? "হিস্টোরি লোড হয়েছে" : "History loaded", 'info');
          }}
        />
      )}
      {isSpeakerProfileOpen && (
        <SpeakerProfileSidebar 
          isOpen={isSpeakerProfileOpen}
          onClose={closeProfile}
          speakerName={speakerName}
          profile={speakerProfile}
          isLoading={isSpeakerLoading}
          error={speakerError || ''}
          onRefresh={() => refreshProfile(speakerName)}
          onUpdateCustomNote={updateCustomNote}
          onSeek={onSeek}
        />
      )}
    </>
  );
};
