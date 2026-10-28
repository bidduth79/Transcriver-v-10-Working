import { useState, useRef, useCallback } from 'react';
import { useAppTheme } from './useAppTheme';
import { useAppModals } from './useAppModals';
import { useApiStats } from './useApiStats';
import { useToast } from './useToast';
import { useHistory } from './useHistory';
import { useTranscription } from './useTranscription';
import { useTranscriptSearch } from './useTranscriptSearch';
import { useBatchProcessor } from './useBatchProcessor';
import { useFileHandler } from './useFileHandler';
import { useFolderWatch } from './useFolderWatch';
import { useAudioRecorder } from './useAudioRecorder';
import { useAudioPlayback } from './useAudioPlayback';
import { useAppEventListeners } from './useAppEventListeners';
import { useTransformTranscript } from './useTransformTranscript';
import { playSuccessSound } from '../utils/audioUtils';
import type { TranscriptMeta } from '../types';

export function useAppCore() {
  const {
    theme, setTheme, appLang, setAppLang, fontSize, setFontSize,
    isDark, t, activeColors, mainBgColor, textColor, cardBg, cardBorder, subTextColor,
    transcriptionMode, setTranscriptionMode
  } = useAppTheme();

  const {
    isSidebarOpen, setIsSidebarOpen,
    isInformationOpen, setIsInformationOpen,
    isActivityLogOpen, setIsActivityLogOpen,
    isReportOpen, setIsReportOpen,
    isSettingsOpen, setIsSettingsOpen
  } = useAppModals();

  const {
    totalApiCalls, activeApiKeySource, activeModelName,
    isAiLoading, setIsAiLoading, updateApiStats
  } = useApiStats();

  const { addToast } = useToast(appLang);

  const onHistoryItemDeletedRef = useRef<(id: string) => void>(() => {});

  const {
    history, historyLimit, setHistoryLimit,
    isHistoryFullscreen, setIsHistoryFullscreen,
    activeHistoryId, setActiveHistoryId,
    histSearch, setHistSearch,
    histDateFilter, setHistDateFilter,
    histSentimentFilter, setHistSentimentFilter,
    showFavoritesOnly, setShowFavoritesOnly,
    toggleFavorite, backupHistory, restoreHistory,
    loadHistory, handleDeleteHistoryItem, filteredHistory, isLoadingHistory
  } = useHistory(appLang, addToast, useCallback((id: string) => {
    onHistoryItemDeletedRef.current(id);
  }, []));

  const {
    status, setStatus,
    transcript, setTranscript,
    errorMessage, setErrorMessage,
    progress, setProgress,
    currentStage, setCurrentStage,
    elapsedSeconds, setElapsedSeconds,
    estimatedSeconds, setEstimatedSeconds,
    file, setFile,
    fileUrl, setFileUrl,
    fileMeta, setFileMeta,
    showSuccessModal, setShowSuccessModal,
    processTranscription, resetAll: resetTranscription
  } = useTranscription(appLang, addToast, loadHistory, updateApiStats, playSuccessSound, transcriptionMode);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transcriptMeta, setTranscriptMeta] = useState<TranscriptMeta | null>(null);

  onHistoryItemDeletedRef.current = () => {
    setTranscript('');
    setStatus('idle');
    setTranscriptMeta(null);
  };

  const handleResetAll = () => {
    resetTranscription();
    setActiveHistoryId(null);
    setTranscriptMeta(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    const folderInput = document.getElementById('folderInput') as HTMLInputElement;
    if (folderInput) {
      folderInput.value = '';
    }
  };

  const {
    searchTerm, setSearchTerm,
    currentMatchIndex, setCurrentMatchIndex,
    matchCount, setMatchCount,
    transcriptSearchInputRef,
    goToNextMatch, goToPrevMatch
  } = useTranscriptSearch(transcript);

  const {
    batchQueue, setBatchQueue,
    currentBatchIndex, setCurrentBatchIndex,
    isBatchProcessing, setIsBatchProcessing,
    hasBatchStarted, setHasBatchStarted,
    isBatchPaused, setIsBatchPaused,
    isExtendedPause,
    batchCountdown, setBatchCountdown,
    failedFiles, processedCount, retryFailedFiles,
    progress: batchProgress, etaSeconds,
    isBatchSummaryOpen, setIsBatchSummaryOpen,
    startBatch, pauseBatch, resumeBatch, cancelBatch, skipNextBatchFile, jumpToBatchFile, removeBatchFile, runFiles
  } = useBatchProcessor(
    appLang, addToast, setFile, setFileUrl, setActiveHistoryId, setTranscriptMeta, setFileMeta, processTranscription
  );

  useFolderWatch(appLang, isBatchProcessing, runFiles);

  const { handleFileChange } = useFileHandler({
    appLang, addToast, setFile, setFileUrl, fileUrl, setActiveHistoryId, setTranscriptMeta, setTranscript, setStatus,
    setFileMeta, processTranscription, history, setBatchQueue, setCurrentBatchIndex, setIsBatchProcessing,
    setHasBatchStarted, setIsBatchPaused, setBatchCountdown, fileInputRef
  });

  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder(
    appLang, addToast, (recordedFile) => handleFileChange({ target: { files: [recordedFile] } })
  );

  const { audioRef, audioCurrentTime, handleSeek, handleTimeUpdate } = useAudioPlayback();

  useAppEventListeners(loadHistory, updateApiStats, addToast, fileUrl);

  const {
    transformingType,
    handleTransformTranscript
  } = useTransformTranscript(transcript, setTranscript, appLang, addToast, updateApiStats);

  return {
    theme, setTheme, appLang, setAppLang, fontSize, setFontSize,
    isDark, t, activeColors, mainBgColor, textColor, cardBg, cardBorder, subTextColor,
    transcriptionMode, setTranscriptionMode,
    isSidebarOpen, setIsSidebarOpen,
    isInformationOpen, setIsInformationOpen,
    isActivityLogOpen, setIsActivityLogOpen,
    isReportOpen, setIsReportOpen,
    isSettingsOpen, setIsSettingsOpen,
    totalApiCalls, activeApiKeySource, activeModelName,
    isAiLoading, setIsAiLoading, updateApiStats,
    addToast,
    history, historyLimit, setHistoryLimit,
    isHistoryFullscreen, setIsHistoryFullscreen,
    activeHistoryId, setActiveHistoryId,
    histSearch, setHistSearch,
    histDateFilter, setHistDateFilter,
    histSentimentFilter, setHistSentimentFilter,
    showFavoritesOnly, setShowFavoritesOnly,
    toggleFavorite, backupHistory, restoreHistory,
    loadHistory, handleDeleteHistoryItem, filteredHistory, isLoadingHistory,
    status, setStatus,
    transcript, setTranscript,
    errorMessage, setErrorMessage,
    progress, setProgress,
    currentStage, setCurrentStage,
    elapsedSeconds, setElapsedSeconds,
    estimatedSeconds, setEstimatedSeconds,
    file, setFile,
    fileUrl, setFileUrl,
    fileMeta, setFileMeta,
    showSuccessModal, setShowSuccessModal,
    processTranscription, resetTranscription,
    handleResetAll,
    transcriptMeta, setTranscriptMeta,
    searchTerm, setSearchTerm,
    currentMatchIndex, setCurrentMatchIndex,
    matchCount, setMatchCount,
    transcriptSearchInputRef,
    goToNextMatch, goToPrevMatch,
    fileInputRef,
    batchQueue, setBatchQueue,
    currentBatchIndex, setCurrentBatchIndex,
    isBatchProcessing, setIsBatchProcessing,
    hasBatchStarted, setHasBatchStarted,
    isBatchPaused, setIsBatchPaused,
    isExtendedPause,
    batchCountdown, setBatchCountdown,
    failedFiles, processedCount, retryFailedFiles,
    batchProgress, etaSeconds,
    isBatchSummaryOpen, setIsBatchSummaryOpen,
    startBatch, pauseBatch, resumeBatch, cancelBatch, skipNextBatchFile, jumpToBatchFile, removeBatchFile,
    handleFileChange,
    isRecording, recordingTime, startRecording, stopRecording,
    audioRef, audioCurrentTime, handleSeek, handleTimeUpdate,
    transformingType, handleTransformTranscript
  };
}

export type AppCore = ReturnType<typeof useAppCore>;
