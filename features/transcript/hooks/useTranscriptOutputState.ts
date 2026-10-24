import React, { useState } from 'react';
import { useTranscriptScroll, useLogoAnimation, useSensitiveKeywords } from './useTranscriptOutput';
import { useBgbAnalysis } from './useBgbAnalysis';
import { useSpeakerProfile } from '../../../hooks/useSpeakerProfile';
import { escapeRegExp } from '../TranscriptViewer';
import type { TranscriptOutputProps } from '../transcriptOutputTypes';
import type { HistoryItem } from '../../../types';
import { uiText } from '../../../utils/uiText';

type Options = Pick<TranscriptOutputProps,
  'appLang' | 'transcript' | 'setTranscript' | 'addToast' | 'activeHistoryId' | 'matchCount' | 'searchTerm' |
  'currentMatchIndex' | 'handleSearchChange' | 'transcriptSearchInputRef' | 'goToNextMatch' | 'status'>;

// Local UI state, scroll/keyword/speaker hooks and handlers used by TranscriptOutput
export const useTranscriptOutputState = ({
  appLang, transcript, setTranscript, addToast, activeHistoryId, matchCount, searchTerm,
  currentMatchIndex, handleSearchChange, transcriptSearchInputRef, goToNextMatch, status
}: Options) => {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const logo = useLogoAnimation();

  // The speaker whose new name is being asked for in the app's own dialog
  const [renamingSpeaker, setRenamingSpeaker] = useState<string | null>(null);
  const handleRenameSpeaker = React.useCallback((oldName: string) => setRenamingSpeaker(oldName), []);

  const submitRename = React.useCallback(async (newName: string) => {
    const oldName = renamingSpeaker;
    if (oldName && newName.trim() !== '' && newName !== oldName) {
      // Find occurrences of **oldName** or **oldName:** and replace with newName
      const regex = new RegExp(`\\*\\*\\s*${escapeRegExp(oldName)}\\s*(:?)\\s*\\*\\*`, 'gi');
      const updatedTranscript = transcript.replace(regex, `**${newName}$1**`);
      setTranscript(updatedTranscript);
      addToast(uiText(appLang, 'speakerRenamedSuccessfully'), 'success');

      if (activeHistoryId) {
        const { getFromStore, addToStore, STORES } = await import('../../../services/db');
        const item = await getFromStore(STORES.HISTORY, activeHistoryId) as HistoryItem | undefined;
        if (item) {
          item.transcript = updatedTranscript;
          await addToStore(STORES.HISTORY, item);
          const { rememberHistoryTranscript } = await import('../../../hooks/history/useHistoryTranscript');
          rememberHistoryTranscript(activeHistoryId, updatedTranscript);
        }
      }
    }
  }, [appLang, renamingSpeaker, transcript, setTranscript, addToast, activeHistoryId]);

  const scroll = useTranscriptScroll(matchCount, searchTerm, currentMatchIndex);
  const keywords = useSensitiveKeywords(transcript);
  const bgb = useBgbAnalysis(transcript, keywords.sensitiveMatches);
  const speaker = useSpeakerProfile(transcript || '');

  const clearSearch = () => {
    handleSearchChange({ target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>);
    transcriptSearchInputRef.current?.focus();
  };

  const handleSummaryClick = () => {
    setIsSummaryOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm) {
      e.preventDefault();
      goToNextMatch();
    }
  };

  return {
    isSummaryOpen, setIsSummaryOpen, isReportOpen, setIsReportOpen, isAnalysisOpen, setIsAnalysisOpen,
    logo, scroll, keywords, bgb, speaker,
    handleRenameSpeaker, renamingSpeaker, setRenamingSpeaker, submitRename, clearSearch, handleSummaryClick, handleKeyDown,
    isDisabled: status !== 'completed',
  };
};

export type TranscriptOutputState = ReturnType<typeof useTranscriptOutputState>;
