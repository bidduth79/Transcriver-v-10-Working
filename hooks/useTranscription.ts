import { useEffect, useRef } from 'react';
import { getActiveProvider, incrementTotalCalls } from '../services/ApiKeyManager';
import { setHeavyProcessingActive } from '../services/firebaseThrottledQueue';
import { logSystemActivity } from '../services/SystemLogger';
import { useTranscriptionState } from './transcription/useTranscriptionState';
import { removeRepetitiveBlocks, calculateEstimatedSeconds, parseDurationToSeconds } from './transcription/transcriptionUtils';
import { formatErrorMessage, resolveEmptyTranscript } from './transcription/transcriptionErrors';
import { getDecodingStage, getProgressStage } from './transcription/transcriptionStages';
import { prepareAudio, keyLabelOf } from './transcription/geminiTranscriptionRunner';
import { transcribeAudio } from './transcription/runTranscription';
import { parseRateLimit } from './transcription/rateLimit';
import { buildHistoryItem, addToInMemoryHistory, persistHistoryItem, scheduleBgbAnalysis } from './transcription/transcriptionHistory';
import { DEFAULT_MODEL } from '../constants/aiModels';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

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

  const startProgressTimer = (estimated: number) => {
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(s => s + 1);
      setProgress(p => {
        const newP = Math.min(p + (100 / estimated), 98);
        setCurrentStage(getProgressStage(newP, appLang));
        return newP;
      });
    }, 1000);
  };

  const processTranscription = async (providedFile?: any, providedMetadata?: any, providedAutoProcess?: any) => {
    const inputFile = (providedFile instanceof Blob) ? providedFile : file;
    const inputMetadata = (providedMetadata && !(providedMetadata instanceof Event) && typeof providedMetadata === 'object') ? providedMetadata : fileMeta;
    const isAutoProcess = typeof providedAutoProcess === 'boolean' ? providedAutoProcess : (typeof providedFile === 'boolean' ? providedFile : false);

    if (!inputFile) return;

    if (inputFile.size > MAX_FILE_SIZE) {
      addToast(appLang === 'bn'
        ? 'ফাইল সাইজ ৫০০ এমবি এর বেশি হতে পারবে না। অনুগ্রহ করে Tools থেকে ফাইলটি Compress করে নিন।'
        : 'File size cannot exceed 500MB. Please compress the file from Tools.', 'error');
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
    const estimated = calculateEstimatedSeconds(audioDurationSeconds, inputFile.size);

    console.debug(`Estimating transcription time: ${estimated}s for ${audioDurationSeconds}s audio`);
    setEstimatedSeconds(estimated);
    setCurrentStage(getDecodingStage(appLang));

    const startTime = Date.now();
    startProgressTimer(estimated);

    let lastUsedKeyLabel = '';
    try {
      const provider = await getActiveProvider();
      if (!provider) {
        throw new Error("No API Key configured. Please add one in Settings.");
      }
      lastUsedKeyLabel = keyLabelOf(provider.source, provider.key);

      const currentFileName = inputMetadata?.name || (inputFile as File).name || 'audio_file';
      const { effectiveFile, effectiveMimeType } = await prepareAudio(inputFile, currentFileName);

      setCurrentStage(appLang === 'bn' ? 'অডিও ডেটা প্রস্তুত করা হচ্ছে...' : 'Preparing audio for AI...');
      const modelName = provider.model || DEFAULT_MODEL;
      const result = await transcribeAudio(effectiveFile, effectiveMimeType, audioDurationSeconds, {
        provider, modelName, mode: transcriptionMode, lang: appLang, setStage: setCurrentStage, addToast,
      });
      const { source: activeSource, finishReason } = result;
      lastUsedKeyLabel = result.keyLabel;

      clearTranscriptionTimer();

      let fullText = removeRepetitiveBlocks(result.text);

      let isNoSpeechDetected = false;
      if (!fullText.trim()) {
        fullText = resolveEmptyTranscript(finishReason, appLang);
        isNoSpeechDetected = true;
      }

      const actualElapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      const historyItem = buildHistoryItem(inputFile, inputMetadata, fullText, actualElapsedSeconds);

      if (!isNoSpeechDetected) {
        await addToInMemoryHistory(historyItem);
      }

      await incrementTotalCalls('Transcription', modelName, activeSource);
      updateApiStats();

      setElapsedSeconds(actualElapsedSeconds);
      setProgress(100);
      setCurrentStage(appLang === 'bn' ? 'সম্পন্ন হয়েছে!' : 'Completed!');
      setTranscript(fullText);
      setStatus('completed');

      // 1. Trigger sound and toast after first paint completes
      setTimeout(() => {
        playSuccessSound();
        if (!isAutoProcess) {
          addToast(
            appLang === 'bn' ? 'ট্রান্সক্রিপশন সফলভাবে সম্পন্ন হয়েছে!' : 'Transcription completed successfully!',
            'success'
          );
        }
      }, 50);

      // 2. Persist locally, 3. then optional background analysis
      if (!isNoSpeechDetected) {
        await persistHistoryItem(historyItem);
      }
      logSystemActivity('TRANSCRIPTION', 'SUCCESS', 'File Transcribed', `File: ${historyItem.fileName}`);
      if (!isNoSpeechDetected) {
        scheduleBgbAnalysis(historyItem, fullText);
      }

      return { success: true, text: fullText };
    } catch (error: any) {
      console.error("Transcription Error:", error);
      setStatus('error');
      const safeMsg = formatErrorMessage(error, appLang, lastUsedKeyLabel);
      setErrorMessage(safeMsg);
      logSystemActivity('TRANSCRIPTION', 'ERROR', 'Failed', safeMsg);
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
