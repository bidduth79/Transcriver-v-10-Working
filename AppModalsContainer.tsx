import React, { lazy, Suspense } from 'react';

const InformationModal = lazy(() => import('./components/modals/InformationModal').then(m => ({ default: m.InformationModal })));
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const ActivityLogsModal = lazy(() => import('./components/modals/ActivityLogsModal').then(m => ({ default: m.ActivityLogsModal })));
const TranscriberReportModal = lazy(() => import('./components/reports/TranscriberReportModal').then(m => ({ default: m.TranscriberReportModal })));
const SuccessModal = lazy(() => import('./components/modals/SuccessModal').then(m => ({ default: m.SuccessModal }))); 
const BatchSummaryModal = lazy(() => import('./components/modals/BatchSummaryModal').then(m => ({ default: m.BatchSummaryModal })));

interface AppModalsContainerProps {
  isInformationOpen: boolean;
  setIsInformationOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isActivityLogOpen: boolean;
  setIsActivityLogOpen: (v: boolean) => void;
  isReportOpen: boolean;
  setIsReportOpen: (v: boolean) => void;
  showSuccessModal: boolean;
  setShowSuccessModal: (v: boolean) => void;
  isBatchSummaryOpen: boolean;
  setIsBatchSummaryOpen: (v: boolean) => void;
  processedCount: number;
  failedFiles: any[];
  retryFailedFiles: () => void;
  elapsedSeconds: number;
  isDark: boolean;
  activeColors: any;
  appLang: 'bn' | 'en';
  addToast: (msg: string, type: any) => void;
  handleFileChange: (e: any, fromModal?: boolean) => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  isInformationOpen, setIsInformationOpen,
  isSettingsOpen, setIsSettingsOpen,
  isActivityLogOpen, setIsActivityLogOpen,
  isReportOpen, setIsReportOpen,
  showSuccessModal, setShowSuccessModal,
  isBatchSummaryOpen, setIsBatchSummaryOpen,
  processedCount, failedFiles, retryFailedFiles,
  elapsedSeconds,
  isDark, activeColors, appLang, addToast,
  handleFileChange
}) => {
  return (
    <Suspense fallback={null}>
      {isInformationOpen && (
        <InformationModal 
          isOpen={isInformationOpen}
          onClose={() => setIsInformationOpen(false)}
          isDark={isDark}
          activeColors={activeColors}
          appLang={appLang}
          addToast={addToast}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDark={isDark}
          activeColors={activeColors}
          appLang={appLang}
          addToast={addToast}
        />
      )}

      {isActivityLogOpen && (
        <ActivityLogsModal 
          isOpen={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
          isDark={isDark}
          activeColors={activeColors}
          appLang={appLang}
        />
      )}

      {isReportOpen && (
        <TranscriberReportModal 
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          isDark={isDark}
          activeColors={activeColors}
          appLang={appLang}
        />
      )}

      {showSuccessModal && (
        <SuccessModal 
          isOpen={showSuccessModal} 
          onClose={() => setShowSuccessModal(false)} 
          elapsedSeconds={elapsedSeconds} 
          appLang={appLang} 
        />
      )}

      {isBatchSummaryOpen && (
        <BatchSummaryModal 
          isOpen={isBatchSummaryOpen}
          onClose={() => setIsBatchSummaryOpen(false)}
          processedCount={processedCount}
          failedFiles={failedFiles}
          onRetryFailed={retryFailedFiles}
          appLang={appLang}
          isDark={isDark}
          activeColors={activeColors}
        />
      )}
    </Suspense>
  );
};
