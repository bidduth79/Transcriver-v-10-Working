import React from 'react';
import { TranscriptContent } from './TranscriptContent';
import { TranscriptSidebarTools } from './TranscriptSidebarTools';
import type { TranscriptOutputProps } from '../transcriptOutputTypes';
import type { TranscriptOutputState } from '../hooks/useTranscriptOutputState';

interface Props {
  props: TranscriptOutputProps;
  state: TranscriptOutputState;
}

// Scrollable transcript card with keyword tools, "Try Again" button and live typing indicator
export const TranscriptReadingView = ({ props, state }: Props) => {
  const {
    t, status, isDark, appLang, searchTerm, goToNextMatch, handleSearchChange, fontSize, activeTranscriptSourceMeta,
    currentMatchIndex, transcript, onSeek, setTranscript, setStatus, setActiveHistoryId, setTranscriptMeta,
  } = props;
  const { scroll, keywords, bgb, speaker, handleRenameSpeaker } = state;
  const { scrollContainerRef, transcriptEndRef, handleScroll } = scroll;
  const { sensitiveMatches, sensitiveWordCounts, isSensitive } = keywords;

  return (
          <>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className={`flex-1 w-full overflow-y-auto transcript-scrollbar p-6 md:p-8 lg:p-16 xl:p-24 relative z-10 ${isSensitive ? (isDark ? 'bg-red-950/10' : 'bg-red-50/30') : ''}`}
            >
              <div className="max-w-6xl mx-auto relative">
                {/* FLOATING SENSITIVE WORDS BOX */}
                <TranscriptSidebarTools
                  sensitiveMatches={sensitiveMatches}
                  sensitiveWordCounts={sensitiveWordCounts}
                  appLang={appLang}
                  isDark={isDark}
                  searchTerm={searchTerm}
                  goToNextMatch={goToNextMatch}
                  handleSearchChange={handleSearchChange}
                  isBgbAnalysisEnabled={bgb.isBgbAnalysisEnabled}
                  setIsBgbAnalysisEnabled={bgb.setIsBgbAnalysisEnabled}
                  bgbAnalysisResult={bgb.bgbAnalysisResult}
                  isAnalyzing={bgb.isAnalyzing}
                  triggerAnalysis={bgb.triggerAnalysis}
                />

                <div className={`p-6 md:p-10 lg:p-20 rounded-[2rem] md:rounded-[3rem] border shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] transition-colors duration-300 group/content ${
                  isSensitive
                    ? (isDark ? 'bg-red-950/30 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-red-50/80 border-red-200 shadow-[0_0_30px_rgba(239,68,68,0.1)]')
                    : (isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/80 border-white/40')
                }`}>
                  <TranscriptContent
                    fontSize={fontSize}
                    isDark={isDark}
                    t={t}
                    activeTranscriptSourceMeta={activeTranscriptSourceMeta}
                    appLang={appLang}
                    searchTerm={searchTerm}
                    currentMatchIndex={currentMatchIndex}
                    transcript={transcript}
                    sensitiveMatches={sensitiveMatches}
                    onSeek={onSeek}
                    openProfile={speaker.openProfile}
                    onRenameSpeaker={handleRenameSpeaker}
                    transcriptEndRef={transcriptEndRef as any}
                    scrollElementRef={scrollContainerRef}
                  />
              </div>
              {status === 'completed' && (
                <div className="h-32 md:h-40 flex items-center justify-center">
                  <button
                    onClick={() => {
                      setTranscript('');
                      setStatus('idle');
                      if (setActiveHistoryId) setActiveHistoryId(null);
                      // Clear transcriptMeta so activeTranscriptSourceMeta falls back to fileMeta
                      // This ensures isSynced becomes true when transcribing again
                      if (typeof setTranscriptMeta === 'function') {
                        setTranscriptMeta(null);
                      }
                    }}
                    className="px-8 md:px-10 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl cursor-pointer flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    {appLang === 'bn' ? 'নতুন করে চেষ্টা করুন' : 'Try Again'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* FLOATING TYPING INDICATOR */}
          {status === 'processing' && (
            <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border ${isDark ? 'bg-slate-900/80 border-slate-700/50 text-indigo-400' : 'bg-white/90 border-slate-200/50 text-indigo-600'}`}>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold text-sm tracking-wide">{appLang === 'bn' ? 'টাইপিং চলছে...' : 'Typing...'}</span>
              </div>
            </div>
          )}
          </>
  );
};
