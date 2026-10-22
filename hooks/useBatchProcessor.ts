import { useState, useRef, useEffect } from 'react';
import { TranscriptMeta, FileMeta } from '../types';
import { useBatchMetrics } from './batch/useBatchMetrics';
import { useBatchTimer } from './batch/useBatchTimer';
import { createBatchRunner, FailedFile } from './batch/batchRunner';
import { setHeavyProcessingActive } from '../services/firebaseThrottledQueue';

export type { FailedFile } from './batch/batchRunner';

export const useBatchProcessor = (
  appLang: 'bn' | 'en',
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void,
  setFile: (file: File) => void,
  setFileUrl: (url: string) => void,
  setActiveHistoryId: (id: string | null) => void,
  setTranscriptMeta: (meta: TranscriptMeta | null) => void,
  setFileMeta: (meta: FileMeta) => void,
  processTranscription: (file: File, metadata: FileMeta, isAutoProcess?: boolean) => Promise<any>
) => {
  const [batchQueue, setBatchQueue] = useState<File[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [hasBatchStarted, setHasBatchStarted] = useState(false);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [isBatchSummaryOpen, setIsBatchSummaryOpen] = useState(false);
  const isBatchPausedRef = useRef(false);
  const prevBatchUrlRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const { progress, etaSeconds, resetMetrics } =
    useBatchMetrics(isBatchProcessing, isBatchPaused, hasBatchStarted, batchQueue.length, currentBatchIndex);
  const { batchCountdown, setBatchCountdown, isExtendedPause, setIsExtendedPause, clearTimer, startCountdown } =
    useBatchTimer(isBatchPausedRef);

  const { processNextBatchFile, clearRetryTimeout } = createBatchRunner({
    appLang, addToast, setFile, setFileUrl, setActiveHistoryId, setTranscriptMeta, setFileMeta, processTranscription,
    isBatchPausedRef, prevBatchUrlRef, retryTimeoutRef,
    setCurrentBatchIndex, setIsBatchProcessing, setHasBatchStarted, setFailedFiles, setProcessedCount, setIsBatchSummaryOpen,
    startCountdown,
  });

  useEffect(() => {
    isBatchPausedRef.current = isBatchPaused;
  }, [isBatchPaused]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setHeavyProcessingActive('batch', false);
      if (prevBatchUrlRef.current) {
        URL.revokeObjectURL(prevBatchUrlRef.current);
        prevBatchUrlRef.current = null;
      }
    };
  }, []);

  const startBatch = () => {
    clearRetryTimeout();
    setHeavyProcessingActive('batch', true);
    setHasBatchStarted(true);
    setIsBatchProcessing(true);
    setIsBatchPaused(false);
    setFailedFiles([]);
    setProcessedCount(0);
    resetMetrics();
    processNextBatchFile(batchQueue, currentBatchIndex);
  };

  const pauseBatch = () => {
    setIsBatchPaused(true);
    setHeavyProcessingActive('batch', false);
    clearTimer();
    clearRetryTimeout();
  };

  const resumeBatch = () => {
    setIsBatchPaused(false);
    setHeavyProcessingActive('batch', true);
    processNextBatchFile(batchQueue, currentBatchIndex);
  };

  const cancelBatch = () => {
    clearTimer();
    clearRetryTimeout();
    setHeavyProcessingActive('batch', false);
    setBatchQueue([]);
    setCurrentBatchIndex(0);
    setIsBatchProcessing(false);
    setHasBatchStarted(false);
    setIsBatchPaused(false);
    setFailedFiles([]);
    setProcessedCount(0);
    resetMetrics();
  };

  const skipNextBatchFile = () => {
    clearTimer();
    clearRetryTimeout();
    processNextBatchFile(batchQueue, currentBatchIndex + 1);
  };

  const jumpToBatchFile = (index: number) => {
    clearTimer();
    clearRetryTimeout();
    setHeavyProcessingActive('batch', true);
    setHasBatchStarted(true);
    setIsBatchPaused(false);
    processNextBatchFile(batchQueue, index);
  };

  const removeBatchFile = (indexToRemove: number) => {
    const newQueue = batchQueue.filter((_, i) => i !== indexToRemove);
    setBatchQueue(newQueue);

    if (indexToRemove < currentBatchIndex) {
      setCurrentBatchIndex(prev => prev - 1);
    } else if (indexToRemove === currentBatchIndex && hasBatchStarted && !isBatchPaused) {
      clearTimer();
      processNextBatchFile(newQueue, currentBatchIndex);
    }

    if (newQueue.length === 0) {
      cancelBatch();
    }
  };

  const retryFailedFiles = () => {
    if (failedFiles.length === 0) return;
    const filesToRetry = failedFiles.map(f => f.file);
    setBatchQueue(filesToRetry);
    setCurrentBatchIndex(0);
    setFailedFiles([]);
    setProcessedCount(0);
    resetMetrics();
    setHeavyProcessingActive('batch', true);
    setHasBatchStarted(true);
    setIsBatchPaused(false);
    setIsBatchProcessing(true);
    processNextBatchFile(filesToRetry, 0);
  };

  return {
    batchQueue, setBatchQueue,
    currentBatchIndex, setCurrentBatchIndex,
    isBatchProcessing, setIsBatchProcessing,
    hasBatchStarted, setHasBatchStarted,
    isBatchPaused, setIsBatchPaused,
    isExtendedPause, setIsExtendedPause,
    batchCountdown, setBatchCountdown,
    failedFiles, processedCount,
    progress, etaSeconds,
    isBatchSummaryOpen, setIsBatchSummaryOpen,
    startBatch, pauseBatch, resumeBatch, cancelBatch, skipNextBatchFile, jumpToBatchFile, removeBatchFile, retryFailedFiles
  };
};
