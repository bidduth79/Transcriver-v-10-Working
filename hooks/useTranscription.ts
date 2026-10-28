import { useEffect, useRef } from 'react';
import { getActiveProvider, incrementTotalCalls } from '../services/ApiKeyManager';
import { setHeavyProcessingActive } from '../services/firebaseThrottledQueue';
import { logSystemActivity } from '../services/SystemLogger';
import { useTranscriptionState } from './transcription/useTranscriptionState';
import { removeRepetitiveBlocks, splitLongParagraphs, calculateEstimatedSeconds, parseDurationToSeconds, learnedSecondsPerAudioSecond } from './transcription/transcriptionUtils';
import { formatErrorMessage, emptyTranscriptError } from './transcription/transcriptionErrors';
import { useHistoryStore } from './useHistoryStore';
import { getDecodingStage, getProgressStage } from './transcription/transcriptionStages';
import { prepareAudio, keyLabelOf } from './transcription/geminiTranscriptionRunner';
import { transcribeAudio } from './transcription/runTranscription';
import { parseRateLimit, type RateLimitInfo } from './transcription/rateLimit';
import type { FileMeta } from '../types';
import { buildHistoryItem, addToInMemoryHistory, persistHistoryItem, scheduleBgbAnalysis } from './transcription/transcriptionHistory';
import { DEFAULT_MODEL } from '../constants/aiModels';
import { uiText } from '../utils/uiText';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export type TranscriptionOutcome =
  | { success: true; text: string }
  | { success: false; error: string; rateLimit: RateLimitInfo };

export const useTranscription = (
  appLang: 'en' | 'bn',
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void,
  loadHistory: () => void,
  updateApiStats: () => void,
  playSuccessSound: () => void,
  transcriptionMode: 'normal' | 'pro'
) => {
  const state = useTranscriptionState();
  const {
    setStatus, setTranscript, setErrorMessage, setProgress,
    setCurrentStage, setElapsedSeconds, setEstimatedSeconds, file, fileMeta,
  } = state;

  const timerRef = useRef<number | null>(null);

  const clearTranscriptionTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTranscriptionTimer();
    };
  }, []);

  // Elapsed time comes from the clock: a background tab slows the timer down but not the clock
  const startProgressTimer = (estimated: number, startedAt: number) => {
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const newP = Math.min((elapsed / estimated) * 100, 98);
      setElapsedSeconds(elapsed);
      setProgress(newP);
      setCurrentStage(getProgressStage(newP, appLang));
    }, 1000);
  };

  // Also used directly as a click handler, so each argument may be something else (an event, a boolean)
  const processTranscription = async (providedFile?: unknown, providedMetadata?: unknown, providedAutoProcess?: unknown): Promise<TranscriptionOutcome | undefined> => {
    const inputFile = (providedFile instanceof Blob) ? providedFile : file;
    const inputMetadata = (providedMetadata && !(providedMetadata instanceof Event) && typeof providedMetadata === 'object') ? providedMetadata as Partial<FileMeta> : fileMeta;
    const isAutoProcess = typeof providedAutoProcess === 'boolean' ? providedAutoProcess : (typeof providedFile === 'boolean' ? providedFile : false);

    if (!inputFile) return;

    if (inputFile.size > MAX_FILE_SIZE) {
      addToast(uiText(appLang, 'fileSizeCannotExceed500mbPlease'), 'error');
      setStatus('idle');
      return;
    }

    clearTranscriptionTimer();
    setHeavyProcessingActive('transcription', true);
    setStatus('processing');
    setTranscript('');
    setProgress(0);
    setElapsedSeconds(0);

    const audioDurationSeconds = parseDurationToSeconds(inputMetadata?.duration);
    // Learned from how long earlier transcriptions took on this device
    const estimated = calculateEstimatedSeconds(audioDurationSeconds, inputFile.size, learnedSecondsPerAudioSecond(useHistoryStore.getState().history));

    console.debug(`Estimating transcription time: ${estimated}s for ${audioDurationSeconds}s audio`);
    setEstimatedSeconds(estimated);
    setCurrentStage(getDecodingStage(appLang));

    const startTime = Date.now();
    startProgressTimer(estimated, startTime);

    let lastUsedKeyLabel = '';
    let modelUsed = '';
    try {
      const provider = await getActiveProvider();
      if (!provider) {
        throw new Error("No API Key configured. Please add one in Settings.");
      }
      lastUsedKeyLabel = keyLabelOf(provider.source, provider.key);

      const currentFileName = inputMetadata?.name || (inputFile as File).name || 'audio_file';
      const { effectiveFile, effectiveMimeType } = await prepareAudio(inputFile, currentFileName);

      setCurrentStage(uiText(appLang, 'preparingAudioForAi'));
      const modelName = provider.model || DEFAULT_MODEL;
      modelUsed = modelName;
      const result = await transcribeAudio(effectiveFile, effectiveMimeType, audioDurationSeconds, {
        provider, modelName, mode: transcriptionMode, lang: appLang, setStage: setCurrentStage, addToast,
      });
      const { source: activeSource, finishReason } = result;
      lastUsedKeyLabel = result.keyLabel;

      clearTranscriptionTimer();

      const fullText = splitLongParagraphs(removeRepetitiveBlocks(result.text));
      // The audio has speech: an answer without text is a failed request, shown as an error to retry
      if (!fullText.trim()) throw emptyTranscriptError(result.emptyReason ?? finishReason, appLang);

      const actualElapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      const historyItem = buildHistoryItem(inputFile, inputMetadata, fullText, actualElapsedSeconds);

      await addToInMemoryHistory(historyItem);

      await incrementTotalCalls('Transcription', modelName, activeSource);
      updateApiStats();

      setElapsedSeconds(actualElapsedSeconds);
      setProgress(100);
      setCurrentStage(uiText(appLang, 'completed'));
      setTranscript(fullText);
      setStatus('completed');

      // 1. Trigger sound and toast after first paint completes
      setTimeout(() => {
        playSuccessSound();
        if (!isAutoProcess) {
          addToast(
            uiText(appLang, 'transcriptionCompletedSuccessfully'),
            'success'
          );
        }
      }, 50);

      // 2. Persist locally, 3. then optional background analysis
      await persistHistoryItem(historyItem);
      logSystemActivity('TRANSCRIPTION', 'SUCCESS', 'File Transcribed',
        `File: ${historyItem.fileName} | model: ${modelUsed} | audio: ${audioDurationSeconds}s | took: ${actualElapsedSeconds}s` +
        ` (estimated ${estimated}s) | parts: ${result.parts} | requests: ${result.requests}`);
      scheduleBgbAnalysis(historyItem, fullText);

      return { success: true, text: fullText };
    } catch (error) {
      console.warn("Transcription Error:", error);
      setStatus('error');
      const safeMsg = formatErrorMessage(error, appLang, lastUsedKeyLabel);
      setErrorMessage(safeMsg);
      logSystemActivity('TRANSCRIPTION', 'ERROR', 'Failed',
        `${safeMsg} | model: ${modelUsed} | audio: ${audioDurationSeconds}s | after: ${Math.round((Date.now() - startTime) / 1000)}s`);
      return { success: false, error: safeMsg, rateLimit: parseRateLimit(error) };
    } finally {
      clearTranscriptionTimer();
      setHeavyProcessingActive('transcription', false);
      setProgress(100);
    }
  };

  return {
    ...state,
    processTranscription
  };
};
