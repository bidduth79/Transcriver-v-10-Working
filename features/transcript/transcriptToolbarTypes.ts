import type React from 'react';
import type { TranscriptOutputProps } from './transcriptOutputTypes';

export type TranscriptToolbarProps = Pick<TranscriptOutputProps, 't' | 'status' | 'appLang' | 'activeColors' | 'searchTerm'
  | 'handleSearchChange' | 'transcriptSearchInputRef' | 'matchCount' | 'currentMatchIndex' | 'fontSize' | 'setFontSize'
  | 'transformTranscript' | 'transformingType' | 'transcript' | 'addToast' | 'setTranscript' | 'setStatus' | 'setActiveHistoryId'> & {
  handleSummaryClick: () => void;
  setIsReportOpen: (open: boolean) => void;
  isDisabled: boolean;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  clearSearch: () => void;
  setIsAnalysisOpen: (open: boolean) => void;
  // The saved transcript's source or the loaded file: only its name is used
  fileMeta: { name?: string } | null;
  sensitiveMatches: string[];
  goToPrevMatch?: () => void;
  goToNextMatch?: () => void;
};
