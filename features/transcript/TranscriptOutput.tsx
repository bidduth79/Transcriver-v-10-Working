import React from 'react';
import { TranscriptModals } from './components/TranscriptModals';
import { ProcessingView } from './ProcessingView.tsx';
import { TranscriptScrollControls } from './components/TranscriptScrollControls';
import { TranscriptIdleView } from './components/TranscriptIdleView';
import { TranscriptErrorView } from './components/TranscriptErrorView';
import { TranscriptReadingView } from './components/TranscriptReadingView';
import { TranscriptToolbar } from './TranscriptToolbar';
import { FormattedTranscript } from './TranscriptViewer';
import { useTranscriptOutputState } from './hooks/useTranscriptOutputState';
import type { TranscriptOutputProps } from './transcriptOutputTypes';

export type { TranscriptOutputProps } from './transcriptOutputTypes';

export const TranscriptOutput: React.FC<TranscriptOutputProps> = (props) => {
  const {
    t, status, transcriptSearchInputRef, searchTerm, handleSearchChange, activeColors, setStatus, setTranscript,
    fileUrl, textColor, isDark, setIsSidebarOpen, fileMeta, processTranscription, transcript,
    fontSize, setFontSize, matchCount, currentMatchIndex, goToNextMatch, goToPrevMatch, errorMessage,
    transformTranscript, transformingType, addToast, appLang, history, onSeek, onModelUpdate, setIsAiLoading,
    progress = 0, currentStage = '', elapsedSeconds = 0, estimatedSeconds = 0, setActiveHistoryId,
  } = props;
  const state = useTranscriptOutputState(props);
  const { logo, scroll, keywords, speaker } = state;

  return (
    <section className="flex-1 flex flex-col overflow-hidden relative transition-all duration-500 ease-in-out">
      {/* Header */}
      <TranscriptToolbar
        t={t} status={status} appLang={appLang} handleSummaryClick={state.handleSummaryClick}
        setIsReportOpen={state.setIsReportOpen} isDisabled={state.isDisabled} activeColors={activeColors}
        searchTerm={searchTerm} handleSearchChange={handleSearchChange} handleKeyDown={state.handleKeyDown}
        clearSearch={state.clearSearch} transcriptSearchInputRef={transcriptSearchInputRef} matchCount={matchCount}
        currentMatchIndex={currentMatchIndex} goToPrevMatch={goToPrevMatch} goToNextMatch={goToNextMatch}
        fontSize={fontSize} setFontSize={setFontSize} transformTranscript={transformTranscript}
        transformingType={transformingType} setIsAnalysisOpen={state.setIsAnalysisOpen} setTranscript={setTranscript}
        setStatus={setStatus} addToast={addToast} setActiveHistoryId={setActiveHistoryId} fileMeta={props.activeTranscriptSourceMeta || fileMeta}
        transcript={transcript} sensitiveMatches={keywords.sensitiveMatches}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden relative transition-colors duration-700`}>
        {/* BACKGROUND IMAGE LAYER - ABSOLUTE */}
        <div className="absolute inset-0 z-0">
          {/* Overlay to ensure text readability against the global video background */}
            <div className={`absolute inset-0 ${isDark ? 'bg-slate-900/40' : 'bg-white/40'} pointer-events-none`}></div>
        </div>

        {/* Loading Spinner - for Transformations */}
        {transformingType !== null && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="w-16 h-16 border-4 border-indigo-400/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
            <p className="text-white font-black uppercase tracking-widest bn:tracking-normal text-sm animate-pulse">{t.processingHeader}...</p>
          </div>
        )}

        {/* PROCESSING STATE (Empty Transcript) */}
        {status === 'processing' && !transcript && (
          <ProcessingView
            t={t} isDark={isDark} textColor={textColor} activeColors={activeColors} progress={progress}
            currentStage={currentStage} elapsedSeconds={elapsedSeconds} estimatedSeconds={estimatedSeconds}
          />
        )}

        {/* IDLE OR EMPTY COMPLETED STATE */}
        {(status === 'idle' || (status === 'completed' && !transcript)) && (
          <TranscriptIdleView
            t={t} fileUrl={fileUrl || ''} isDark={isDark} activeColors={activeColors} fileMeta={fileMeta}
            setIsSidebarOpen={setIsSidebarOpen} processTranscription={processTranscription}
            logoOffset={logo.logoOffset} logoContainerRef={logo.logoContainerRef}
            handleLogoMouseMove={logo.handleLogoMouseMove} handleLogoMouseLeave={logo.handleLogoMouseLeave}
          />
        )}

        {/* COMPLETED WITH TRANSCRIPT OR PROCESSING WITH TRANSCRIPT STATE */}
        {((status === 'completed' && transcript) || (status === 'processing' && transcript)) && (
          <TranscriptReadingView props={props} state={state} />
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <TranscriptErrorView errorMessage={errorMessage} isDark={isDark} setStatus={setStatus} />
        )}
      </div>

      {(status === 'completed' || (status === 'processing' && transcript)) && (
        <TranscriptScrollControls
          localScrollPercent={scroll.localScrollPercent} scrollToTop={scroll.scrollToTop}
          scrollToBottom={scroll.scrollToBottom} activeColors={activeColors}
        />
      )}

      {/* Modals */}
      <TranscriptModals
        isSummaryOpen={state.isSummaryOpen} setIsSummaryOpen={state.setIsSummaryOpen}
        isReportOpen={state.isReportOpen} setIsReportOpen={state.setIsReportOpen}
        isAnalysisOpen={state.isAnalysisOpen} setIsAnalysisOpen={state.setIsAnalysisOpen}
        isSpeakerProfileOpen={speaker.isOpen} closeProfile={speaker.closeProfile} speakerName={speaker.speakerName}
        speakerProfile={speaker.profile} isSpeakerLoading={speaker.isLoading} speakerError={speaker.error}
        refreshProfile={speaker.refreshProfile} updateCustomNote={speaker.updateCustomNote}
        transcript={transcript} activeColors={activeColors} isDark={isDark} appLang={appLang}
        searchTerm={searchTerm} matchCount={matchCount} fileMeta={fileMeta} addToast={addToast} onSeek={onSeek}
        onModelUpdate={onModelUpdate} setIsAiLoading={setIsAiLoading} history={history}
        FormattedTranscript={FormattedTranscript} currentMatchIndex={currentMatchIndex}
        sensitiveMatches={keywords.sensitiveMatches} openProfile={speaker.openProfile}
        setTranscript={setTranscript} setStatus={setStatus}
      />
    </section>
  );
};
