import React from 'react';
import { TranscriptMeta, FileMeta } from '../../types';
import { getFileMetadata } from './batchUtils';
import { setHeavyProcessingActive } from '../../services/firebaseThrottledQueue';
import type { RateLimitInfo } from '../transcription/rateLimit';
import type { FailureKind } from '../transcription/transcriptionErrors';
import { planAfterFailure, BATCH_FILE_LOCK, OTHER_TAB_WAIT_MS } from './batchFailure';
import { claimTabLock } from '../../services/tabLock';
import { notifyWhenHidden } from '../../services/browserNotification';
import { messageOf } from '../../utils/errorMessage';
import type { TranscriptionOutcome } from '../useTranscription';
import { uiText } from '../../utils/uiText';
import { isJobInBackground } from '../transcription/useBackgroundJobStore';
import { useHistoryStore } from '../useHistoryStore';
import { useBatchDuplicateStore } from './useBatchDuplicateStore';
import { isAlreadyTranscribed } from '../../utils/sameRecording';

export interface FailedFile {
  file: File;
  reason: string;
}

const MAX_FILE_SIZE = 70 * 1024 * 1024;

export interface BatchRunnerContext {
  appLang: 'bn' | 'en';
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setFile: (file: File) => void;
  setFileUrl: (url: string) => void;
  setActiveHistoryId: (id: string | null) => void;
  setTranscriptMeta: (meta: TranscriptMeta | null) => void;
  setFileMeta: (meta: FileMeta) => void;
  processTranscription: (file: File, metadata: FileMeta, isAutoProcess?: boolean) => Promise<TranscriptionOutcome | undefined>;
  isBatchPausedRef: React.MutableRefObject<boolean>;
  prevBatchUrlRef: React.MutableRefObject<string | null>;
  retryTimeoutRef: React.MutableRefObject<number | null>;
  // Index waiting in the countdown, and index being transcribed right now (null when none)
  pendingNextIndexRef: React.MutableRefObject<number | null>;
  inFlightIndexRef: React.MutableRefObject<number | null>;
  // Stops the batch at `index` (kept for resume) when every key's daily quota is used up
  pauseForQuota: (index: number) => void;
  setCurrentBatchIndex: (i: number) => void;
  setIsBatchProcessing: (b: boolean) => void;
  setHasBatchStarted: (b: boolean) => void;
  setFailedFiles: React.Dispatch<React.SetStateAction<FailedFile[]>>;
  setProcessedCount: React.Dispatch<React.SetStateAction<number>>;
  setIsBatchSummaryOpen: (b: boolean) => void;
  startCountdown: (nextIndex: number, queueLength: number, onTickComplete: () => void, onFinish: () => void) => void;
}

// Processes one queue item at a time: transcribe → countdown → next, with one retry per failed file
export const createBatchRunner = (ctx: BatchRunnerContext) => {
  const { appLang, addToast, isBatchPausedRef, prevBatchUrlRef, retryTimeoutRef, pendingNextIndexRef, inFlightIndexRef } = ctx;

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const finishProcessing = () => {
    clearRetryTimeout();
    setHeavyProcessingActive('batch', false);
    ctx.setIsBatchProcessing(false);
    ctx.setHasBatchStarted(false);

    ctx.setFailedFiles(prevFailed => {
      ctx.setProcessedCount(prevProcessed => {
        if (prevFailed.length > 0) {
          const message = uiText(appLang, 'batchCompletedWithFailures', { prevProcessed, failed: prevFailed.length });
          addToast(message, 'warning');
          notifyWhenHidden('LI CELL Studio', message);
        } else {
          const message = uiText(appLang, 'batchProcessingCompletedSuccessfully');
          addToast(message, 'success');
          notifyWhenHidden('LI CELL Studio', message);
        }
        ctx.setIsBatchSummaryOpen(true);
        return prevProcessed;
      });
      return prevFailed;
    });
  };

  const startCountdownForNextFile = (queue: File[], nextIndex: number) => {
    if (isBatchPausedRef.current) {
      ctx.setCurrentBatchIndex(nextIndex);
      setHeavyProcessingActive('batch', false);
      return;
    }
    pendingNextIndexRef.current = nextIndex < queue.length ? nextIndex : null;
    ctx.startCountdown(nextIndex, queue.length, () => processNextBatchFile(queue, nextIndex), finishProcessing);
  };

  // Tries the same file again after a wait, unless the batch was paused meanwhile
  const tryAgainAfter = (waitMs: number, queue: File[], index: number, retryCount: number, toldWaiting = false) => {
    clearRetryTimeout();
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null;
      if (!isBatchPausedRef.current) processNextBatchFile(queue, index, retryCount, toldWaiting);
      else ctx.setCurrentBatchIndex(index);
    }, waitMs);
  };

  const processNextBatchFile = async (queue: File[], index: number, retryCount = 0, toldWaiting = false): Promise<void> => {
    clearRetryTimeout();
    pendingNextIndexRef.current = null;
    if (index >= queue.length) {
      startCountdownForNextFile(queue, index);
      return;
    }

    // Lock Firebase sync so zero cloud streams conflict with batch audio processing
    setHeavyProcessingActive('batch', true);

    const currentFile = queue[index];
    ctx.setCurrentBatchIndex(index);

    // Already transcribed: skipped without spending a request, unless the user chose to transcribe it anyway
    const duplicates = useBatchDuplicateStore.getState();
    if (!duplicates.allowed.includes(currentFile) && isAlreadyTranscribed(currentFile, useHistoryStore.getState().history)) {
      duplicates.addSkipped(currentFile);
      addToast(uiText(appLang, 'duplicateSkipped', { name: currentFile.name }), 'info');
      return processNextBatchFile(queue, index + 1);
    }

    if (currentFile.size > MAX_FILE_SIZE) {
      addToast(uiText(appLang, 'fileTooLargeSkipping', { name: currentFile.name }), 'error');
      ctx.setFailedFiles(prev => [...prev, { file: currentFile, reason: 'Size exceeds 70MB' }]);
      startCountdownForNextFile(queue, index + 1);
      return;
    }

    // One file at a time across the app's tabs. While another tab transcribes, this one waits its turn and then
    // starts this file from the top again, so a file the other tab has just done is skipped as already transcribed.
    const release = await claimTabLock(BATCH_FILE_LOCK);
    if (!release) {
      if (!toldWaiting) addToast(uiText(appLang, 'otherTabTranscribing'), 'info');
      return tryAgainAfter(OTHER_TAB_WAIT_MS, queue, index, retryCount, true);
    }

    // Revoke previous Object URL first and yield 150ms for V8 Garbage Collector before allocating new audio buffers
    if (prevBatchUrlRef.current) {
      URL.revokeObjectURL(prevBatchUrlRef.current);
      prevBatchUrlRef.current = null;
    }
    if (index > 0) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // While a saved transcript is open, the batch goes on in the background and leaves the screen alone
    const onScreen = !isJobInBackground();
    if (onScreen) {
      ctx.setFile(currentFile);
      const url = URL.createObjectURL(currentFile);
      prevBatchUrlRef.current = url;
      ctx.setFileUrl(url);
      ctx.setActiveHistoryId(null);
      ctx.setTranscriptMeta(null);
    }

    inFlightIndexRef.current = index;
    try {
      const metadata = await getFileMetadata(currentFile);
      if (!isJobInBackground()) ctx.setFileMeta(metadata);
      const result = await ctx.processTranscription(currentFile, metadata, true);
      release();
      // processTranscription reports a failure in its result instead of throwing
      if (result?.success === false) {
        throw Object.assign(new Error(result.error || 'Transcription failed'), { rateLimit: result.rateLimit, kind: result.kind });
      }
      inFlightIndexRef.current = null;
      ctx.setProcessedCount(prev => prev + 1);
      startCountdownForNextFile(queue, index + 1);
    } catch (error) {
      release();
      inFlightIndexRef.current = null;
      console.error(`Error processing ${currentFile.name}:`, error);
      const { rateLimit, kind } = (error ?? {}) as { rateLimit?: RateLimitInfo; kind?: FailureKind };
      const plan = planAfterFailure(kind, rateLimit, retryCount);

      if (plan.action === 'pause') {
        // No key has quota left today, or the server stays busy: pause here instead of failing the rest
        ctx.pauseForQuota(index);
        addToast(uiText(appLang, plan.why === 'quota' ? 'dailyQuotaIsUsedUpOn' : 'serverBusyBatchPaused'), 'error');
      } else if (plan.action === 'retry') {
        addToast(uiText(appLang, plan.busy ? 'serverBusyWaiting' : 'fileFailedRetrying', { name: currentFile.name, minutes: plan.waitMs / 60_000 }), 'warning');
        tryAgainAfter(plan.waitMs, queue, index, retryCount + 1);
      } else {
        addToast(uiText(appLang, 'fileTranscribeFailed', { name: currentFile.name }), 'error');
        ctx.setFailedFiles(prev => [...prev, { file: currentFile, reason: messageOf(error) || 'Transcription failed' }]);
        startCountdownForNextFile(queue, index + 1);
      }
    }
  };

  return { processNextBatchFile, clearRetryTimeout };
};
