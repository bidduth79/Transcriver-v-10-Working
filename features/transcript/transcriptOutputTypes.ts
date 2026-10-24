import React from 'react';
import { FileMeta, HistoryItem, TranscriptMeta } from '../../types';
import type { Translations } from '../../translations';
import type { ActiveColors } from '../../hooks/useAppTheme';
import type { ToastType } from '../../hooks/useToast';

export interface TranscriptOutputProps {
  t: Translations;
  status: string;
  transcriptSearchInputRef: React.RefObject<HTMLInputElement | null>;
  searchTerm: string;
  // Also called with just { target: { value } } when a keyword chip is clicked
  handleSearchChange: (e: { target: { value: string } }) => void;
  activeColors: ActiveColors;
  setStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void;
  setTranscript: (transcript: string) => void;
  fileUrl: string | null;
  textColor: string;
  isDark: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  fileMeta: Partial<FileMeta>;
  processTranscription: () => void;
  transcript: string;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  matchCount: number;
  currentMatchIndex: number;
  goToNextMatch: () => void;
  goToPrevMatch: () => void;
  errorMessage: string;
  transformTranscript: (type: 'translate' | 'encoding', targetLang?: 'en' | 'bn') => void;
  transformingType: string | null;
  addToast: (msg: string, type: ToastType) => void;
  appLang: 'bn' | 'en';
  history: HistoryItem[];
  // A transcript timestamp such as "[01:15]", or seconds
  onSeek: (time: string | number) => void;
  onModelUpdate: () => void;
  setIsAiLoading: (isLoading: boolean) => void;
  // The saved transcript's source, or the loaded file's info
  activeTranscriptSourceMeta: Partial<TranscriptMeta> | null;
  progress: number;
  currentStage: string;
  elapsedSeconds: number;
  estimatedSeconds: number;
  setActiveHistoryId: (id: string | null) => void;
  activeHistoryId: string | null;
  setTranscriptMeta: (meta: TranscriptMeta | null) => void;
}
