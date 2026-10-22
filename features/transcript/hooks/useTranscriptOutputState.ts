import React, { useState } from 'react';
import { useTranscriptScroll, useLogoAnimation, useSensitiveKeywords } from './useTranscriptOutput';
import { useBgbAnalysis } from './useBgbAnalysis';
import { useSpeakerProfile } from '../../../hooks/useSpeakerProfile';
import { escapeRegExp } from '../TranscriptViewer';
import type { TranscriptOutputProps } from '../transcriptOutputTypes';

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

  const handleRenameSpeaker = React.useCallback(async (oldName: string) => {
    const newName = window.prompt(appLang === 'bn' ? `"${oldName}" এর নতুন নাম দিন:` : `Rename "${oldName}" to:`, oldName);
    if (newName && newName.trim() !== '' && newName !== oldName) {
      // Find occurrences of **oldName** or **oldName:** and replace with newName
      const regex = new RegExp(`\\*\\*\\s*${escapeRegExp(oldName)}\\s*(:?)\\s*\\*\\*`, 'gi');
      const updatedTranscript = transcript.replace(regex, `**${newName}$1**`);
      setTranscript(updatedTranscript);
      addToast(appLang === 'bn' ? 'স্পীকারের নাম পরিবর্তন করা হয়েছে' : 'Speaker renamed successfully', 'success');

      if (activeHistoryId) {
        const { getFromStore, addToStore, STORES } = await import('../../../services/db');
        const item: any = await getFromStore(STORES.HISTORY, activeHistoryId);
        if (item) {
          item.transcript = updatedTranscript;
          await addToStore(STORES.HISTORY, item);
        }
      }
    }
  }, [appLang, transcript, setTranscript, addToast, activeHistoryId]);

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
    handleRenameSpeaker, clearSearch, handleSummaryClick, handleKeyDown,
    isDisabled: status !== 'completed',
  };
};

export type TranscriptOutputState = ReturnType<typeof useTranscriptOutputState>;
