import React from 'react';
import { TranscriptMeta, FileMeta } from '../../types';
import { getFileMetadata } from './batchUtils';
import { setHeavyProcessingActive } from '../../services/firebaseThrottledQueue';
import { rateLimitWaitMs, type RateLimitInfo } from '../transcription/rateLimit';

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
  processTranscription: (file: File, metadata: FileMeta, isAutoProcess?: boolean) => Promise<any>;
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
          addToast(appLang === 'bn'
            ? `ব্যাচ সম্পন্ন। ${prevProcessed}টি সফল, ${prevFailed.length}টি ব্যর্থ।`
            : `Batch completed. ${prevProcessed} succeeded, ${prevFailed.length} failed.`, 'warning');
        } else {
          addToast(appLang === 'bn' ? 'ব্যাচ প্রসেসিং সফলভাবে সম্পন্ন হয়েছে' : 'Batch processing completed successfully', 'success');
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

  const processNextBatchFile = async (queue: File[], index: number, retryCount = 0): Promise<void> => {
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

    if (currentFile.size > MAX_FILE_SIZE) {
      addToast(appLang === 'bn' ? `${currentFile.name} ৭০ এমবি এর বেশি, স্কিপ করা হচ্ছে` : `${currentFile.name} exceeds 70MB, skipping`, 'error');
      ctx.setFailedFiles(prev => [...prev, { file: currentFile, reason: 'Size exceeds 70MB' }]);
      startCountdownForNextFile(queue, index + 1);
      return;
    }

    // Revoke previous Object URL first and yield 150ms for V8 Garbage Collector before allocating new audio buffers
    if (prevBatchUrlRef.current) {
      URL.revokeObjectURL(prevBatchUrlRef.current);
      prevBatchUrlRef.current = null;
    }
    if (index > 0) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    ctx.setFile(currentFile);
    const url = URL.createObjectURL(currentFile);
    prevBatchUrlRef.current = url;
    ctx.setFileUrl(url);
    ctx.setActiveHistoryId(null);
    ctx.setTranscriptMeta(null);

    inFlightIndexRef.current = index;
    try {
      const metadata = await getFileMetadata(currentFile);
      ctx.setFileMeta(metadata);
      const result = await ctx.processTranscription(currentFile, metadata, true);
      // processTranscription reports a failure in its result instead of throwing
      if (result?.success === false) {
        throw Object.assign(new Error(result.error || 'Transcription failed'), { rateLimit: result.rateLimit });
      }
      inFlightIndexRef.current = null;
      ctx.setProcessedCount(prev => prev + 1);
      startCountdownForNextFile(queue, index + 1);
    } catch (error: any) {
      inFlightIndexRef.current = null;
      console.error(`Error processing ${currentFile.name}:`, error);
      const limit: RateLimitInfo | undefined = error?.rateLimit;

      // No key has quota left today: pause here instead of failing (and spending requests on) the rest
      if (limit?.isDaily) {
        ctx.pauseForQuota(index);
        addToast(appLang === 'bn'
          ? 'সব এপিআই কি-র আজকের কোটা শেষ, তাই ব্যাচ থামানো হয়েছে। নতুন কি যোগ করে বা কোটা রিসেটের পর (বাংলাদেশ সময় দুপুর ১-২টা) আবার চালু করুন।'
          : 'Daily quota is used up on every API key, so the batch was paused. Add a key or resume after the quota resets (midnight Pacific time).', 'error');
        return;
      }

      if (retryCount < 1) {
        addToast(appLang === 'bn' ? `${currentFile.name} ব্যর্থ হয়েছে, আবার চেষ্টা করা হচ্ছে...` : `${currentFile.name} failed, retrying...`, 'warning');
        clearRetryTimeout();
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          if (!isBatchPausedRef.current) {
            processNextBatchFile(queue, index, retryCount + 1);
          } else {
            ctx.setCurrentBatchIndex(index);
          }
        }, (limit && rateLimitWaitMs(limit)) || 3000);
      } else {
        addToast(appLang === 'bn' ? `${currentFile.name} ট্রান্সক্রাইব করা যায়নি` : `Failed to transcribe ${currentFile.name}`, 'error');
        ctx.setFailedFiles(prev => [...prev, { file: currentFile, reason: error?.message || 'Transcription failed' }]);
        startCountdownForNextFile(queue, index + 1);
      }
    }
  };

  return { processNextBatchFile, clearRetryTimeout };
};
