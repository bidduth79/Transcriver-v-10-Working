import { useState, useEffect, useRef } from 'react';

export const useBatchMetrics = (
  isBatchProcessing: boolean, 
  isBatchPaused: boolean, 
  hasBatchStarted: boolean,
  batchQueue: File[],
  currentBatchIndex: number
) => {
  const batchQueueLength = batchQueue.length;
  const [activeProcessingTime, setActiveProcessingTime] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  
  const lastStartTimeRef = useRef<number | null>(null);

  // Timer to update active processing time and ETA
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBatchProcessing && !isBatchPaused && hasBatchStarted) {
      lastStartTimeRef.current = Date.now();
      interval = setInterval(() => {
        if (lastStartTimeRef.current) {
          const now = Date.now();
          const delta = now - lastStartTimeRef.current;
          setActiveProcessingTime(prev => prev + delta);
          lastStartTimeRef.current = now;
        }
      }, 1000);
    } else {
      lastStartTimeRef.current = null;
    }
    return () => clearInterval(interval);
  }, [isBatchProcessing, isBatchPaused, hasBatchStarted]);

  // Calculate Progress and ETA
  useEffect(() => {
    if (batchQueueLength === 0) {
      setProgress(0);
      setEtaSeconds(null);
      return;
    }

    const currentProgress = (currentBatchIndex / batchQueueLength) * 100;
    setProgress(currentProgress);

    // Time grows with the audio, not the number of files: the time spent on the finished files is scaled
    // by how much audio (file size, about the same per minute within a format) is still left
    const doneBytes = batchQueue.slice(0, currentBatchIndex).reduce((sum, f) => sum + f.size, 0);
    const leftBytes = batchQueue.slice(currentBatchIndex).reduce((sum, f) => sum + f.size, 0);
    if (doneBytes > 0 && activeProcessingTime > 0) {
      setEtaSeconds(Math.round((activeProcessingTime * (leftBytes / doneBytes)) / 1000));
    } else {
      setEtaSeconds(null);
    }
  }, [currentBatchIndex, batchQueue, batchQueueLength, activeProcessingTime]);

  const resetMetrics = () => {
    setActiveProcessingTime(0);
  };

  return {
    progress,
    etaSeconds,
    activeProcessingTime,
    resetMetrics
  };
};
