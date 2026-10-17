import { useEffect, useRef } from 'react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { getActiveProvider, incrementTotalCalls } from '../services/ApiKeyManager';

import { addToStore, STORES } from '../services/db';
import { logSystemActivity } from '../services/SystemLogger';
import { TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT, TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL, TRANSCRIPTION_PROMPT_TEXT_NORMAL } from '../constants/instructions';
import { useTranscriptionState } from './transcription/useTranscriptionState';
import { 
  removeRepetitiveBlocks, 
  calculateEstimatedSeconds, 
  parseDurationToSeconds,
  detectAudioMimeType,
  convertAudioToWav,
  blobToBase64,
  isFormatNativelySupportedByGemini
} from './transcription/transcriptionUtils';

const formatErrorMessage = (rawError: any, lang: 'bn' | 'en'): string => {
  let rawMsg = typeof rawError === 'string' ? rawError : (rawError?.message || "Unknown error occurred");
  
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
        try {
            const innerParsed = JSON.parse(parsed.error.message);
            if (innerParsed?.error?.message) {
                rawMsg = innerParsed.error.message;
            } else {
                rawMsg = parsed.error.message;
            }
        } catch(e) {
            rawMsg = parsed.error.message;
        }
    }
  } catch (e) {
    // Not a JSON string
  }

  const lowerMsg = rawMsg.toLowerCase();
  
  if (lowerMsg.includes('no api key') || lowerMsg.includes('api key configured') || lowerMsg.includes('api_key')) {
      return lang === 'bn'
        ? "কোনো এপিআই কি (API Key) পাওয়া যায়নি। দয়া করে সেটিংস (Settings) থেকে আপনার জেমিনি এপিআই কি যুক্ত করুন।"
        : "No API Key configured. Please add your Gemini API Key in Settings.";
  }
  
  if (lowerMsg.includes('503') || lowerMsg.includes('unavailable') || lowerMsg.includes('high demand') || lowerMsg.includes('overloaded')) {
      return lang === 'bn' 
        ? "সার্ভারে এখন অনেক চাপ রয়েছে (High Demand)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
        : "The server is currently experiencing high demand. Please try again later.";
  }
  
  if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit')) {
      return lang === 'bn' 
        ? "আপনার এপিআই কোটা শেষ হয়ে গেছে অথবা লিমিট অতিক্রম করেছে।"
        : "Your API quota has been exceeded or rate limit reached.";
  }
  
  if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument') || lowerMsg.includes('bad request')) {
      return lang === 'bn' 
        ? "ভুল রিকোয়েস্ট বা ফাইল সাইজ/ফরম্যাট সাপোর্ট করছে না।"
        : "Bad request. The file size or format might not be supported.";
  }

  if (lowerMsg.includes('fetch') || lowerMsg.includes('network') || lowerMsg.includes('failed to fetch')) {
      return lang === 'bn'
        ? "নেটওয়ার্ক কানেকশন সমস্যা। দয়া করে আপনার ইন্টারনেট কানেকশন চেক করুন।"
        : "Network connection issue. Please check your internet connection.";
  }

  return rawMsg.length > 300 ? rawMsg.substring(0, 300) + '...' : rawMsg;
};

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
    resetAll
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

  const processTranscription = async (providedFile?: any, providedMetadata?: any, providedAutoProcess?: any) => {
    const inputFile = (providedFile instanceof Blob) ? providedFile : file;
    const inputMetadata = (providedMetadata && !(providedMetadata instanceof Event) && typeof providedMetadata === 'object') ? providedMetadata : fileMeta;
    const isAutoProcess = typeof providedAutoProcess === 'boolean' ? providedAutoProcess : (typeof providedFile === 'boolean' ? providedFile : false);

    if (!inputFile) return;

    if (inputFile.size > 500 * 1024 * 1024) {
      addToast(appLang === 'bn' 
        ? 'ফাইল সাইজ ৫০০ এমবি এর বেশি হতে পারবে না। অনুগ্রহ করে Tools থেকে ফাইলটি Compress করে নিন।' 
        : 'File size cannot exceed 500MB. Please compress the file from Tools.', 'error');
      setStatus('idle');
      return;
    }

    clearTranscriptionTimer();
    setStatus('processing');
    setTranscript('');
    setProgress(0);
    setElapsedSeconds(0);
    
    const audioDurationSeconds = parseDurationToSeconds(inputMetadata?.duration);
    const estimated = calculateEstimatedSeconds(audioDurationSeconds, inputFile.size);

    console.debug(`Estimating transcription time: ${estimated}s for ${audioDurationSeconds}s audio`);
    setEstimatedSeconds(estimated);
    setCurrentStage(appLang === 'bn' ? 'অডিও সিগন্যাল ডিকোড করা হচ্ছে...' : 'Decoding audio signals...');
    
    const startTime = Date.now();
    
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(s => s + 1);
      setProgress(p => {
        const newP = Math.min(p + (100 / estimated), 98);
        
        if (newP < 15) {
          setCurrentStage(appLang === 'bn' ? 'অডিও সিগন্যাল ডিকোড করা হচ্ছে...' : 'Decoding audio signals...');
        } else if (newP < 30) {
          setCurrentStage(appLang === 'bn' ? 'ভয়েস অ্যাক্টিভিটি ডিটেকশন (VAD) চলছে...' : 'Running Voice Activity Detection (VAD)...');
        } else if (newP < 45) {
          setCurrentStage(appLang === 'bn' ? 'নিউরাল স্পিচ রিকগনিশন মডেল ইনিশিয়ালাইজ হচ্ছে...' : 'Initializing neural speech recognition models...');
        } else if (newP < 60) {
          setCurrentStage(appLang === 'bn' ? 'অডিও ফিচার এক্সট্রাকশন এবং টোকেনাইজেশন চলছে...' : 'Audio feature extraction and tokenization...');
        } else if (newP < 75) {
          setCurrentStage(appLang === 'bn' ? 'এআই ইনফারেন্স এবং টেক্সট জেনারেশন চলছে...' : 'AI inference and text generation in progress...');
        } else if (newP < 90) {
          setCurrentStage(appLang === 'bn' ? 'ন্যাচারাল ল্যাঙ্গুয়েজ প্রসেসিং (NLP) প্রয়োগ করা হচ্ছে...' : 'Applying Natural Language Processing (NLP)...');
        } else {
          setCurrentStage(appLang === 'bn' ? 'ফাইনাল আউটপুট অপ্টিমাইজ ও ফরম্যাটিং করা হচ্ছে...' : 'Optimizing and formatting final output...');
        }
        
        return newP;
      });
    }, 1000);

    try {
      const checkProvider = await getActiveProvider();
      
      if (!checkProvider) {
        throw new Error("No API Key configured. Please add one in Settings.");
      }

      const ai = new GoogleGenAI({ apiKey: checkProvider.key });

      const currentFileName = inputMetadata?.name || (inputFile as File).name || 'audio_file';
      const lowerName = currentFileName.toLowerCase();
      
      // Sniff accurate MIME type from magic bytes and filename (fixes audio/opus and WhatsApp voice notes)
      const sniffed = await detectAudioMimeType(inputFile, currentFileName);
      let effectiveMimeType = sniffed.mimeType || inputFile.type || 'audio/mp3';
      if (effectiveMimeType.includes('opus') || lowerName.endsWith('.opus') || lowerName.endsWith('.ogg')) {
        effectiveMimeType = 'audio/ogg';
      }
      
      let effectiveFile: Blob = inputFile;

      // For small voice notes / clips (<= 1MB), normalize quiet audio into 16kHz mono PCM WAV
      if (inputFile.size <= 1 * 1024 * 1024 && (sniffed.isOggOpus || sniffed.isWhatsApp || lowerName.endsWith('.opus') || lowerName.endsWith('.ogg'))) {
        const wavConverted = await convertAudioToWav(inputFile, 16000);
        if (wavConverted && wavConverted.wavBlob) {
          effectiveFile = wavConverted.wavBlob;
          effectiveMimeType = 'audio/wav';
        }
      }

      let audioPart: any;
      let uploadedFile: any = null;

      // Use Base64 inlineData
      setCurrentStage(appLang === 'bn' ? 'অডিও ডেটা প্রস্তুত করা হচ্ছে...' : 'Preparing audio for AI...');
      let base64Data = await blobToBase64(effectiveFile);
      audioPart = {
        inlineData: {
          mimeType: effectiveMimeType,
          data: base64Data
        }
      };
      
      const systemInstruction = transcriptionMode === 'normal' 
        ? TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL 
        : TRANSCRIPTION_SYSTEM_INSTRUCTION;

      const modelName = checkProvider.model || 'gemini-2.5-flash';
      let promptText = transcriptionMode === 'normal' 
        ? TRANSCRIPTION_PROMPT_TEXT_NORMAL 
        : TRANSCRIPTION_PROMPT_TEXT;

      if (modelName === 'gemini-3.1-flash-lite-preview') {
          promptText += "\n\nCRITICAL FOR THIS MODEL: Ensure every timestamp like [MM:SS] starts on a NEW LINE. Do NOT put timestamps in the middle of text. Each speaker's dialogue MUST be on a separate line. Example:\n[00:00] **Speaker 1:** Hello.\n[00:05] **Speaker 2:** Hi there.";
      }

      const requestOptions = {
          model: modelName, 
          contents: [
              {
                  role: 'user',
                  parts: [
                      audioPart,
                      { text: promptText }
                  ]
              }
          ],
          config: {
              systemInstruction: systemInstruction,
              temperature: 0.35,
              safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              ]
          }
      };

      const extractText = (resp: any): string => {
        if (!resp) return '';
        try {
          if (Array.isArray(resp.candidates) && resp.candidates.length > 0) {
            const candidate = resp.candidates[0];
            if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
              let extracted = '';
              for (const part of candidate.content.parts) {
                if (part?.text && !part.thought) {
                  extracted += part.text;
                }
              }
              if (extracted.trim()) return extracted;
              for (const part of candidate.content.parts) {
                if (part?.text) {
                  extracted += part.text;
                }
              }
              if (extracted.trim()) return extracted;
            }
          }
          if (typeof resp.text === 'string' && resp.text.trim()) {
            return resp.text;
          }
        } catch (e) {
          console.warn("Could not read text property directly:", e);
        }
        return '';
      };

      let fullText = '';
      let lastResultObj: any = null;

      setCurrentStage(appLang === 'bn' ? 'এআই সার্ভারে সম্পূর্ণ অডিও বিশ্লেষণ ও ট্রান্সক্রাইব করা হচ্ছে...' : 'Transcribing media on AI server...');
      
      try {
          const response = await ai.models.generateContent(requestOptions);
          lastResultObj = response;
          fullText = extractText(response);
      } catch (err: any) {
          console.error("Transcription generation failed:", err);
          if (err?.message?.includes('RECITATION') || err?.message?.includes('Recitation')) {
            console.warn("Caught recitation in generateContent error");
          } else {
            throw err;
          }
      } finally {
          // CRITICAL: Release the massive base64 audio data from memory immediately
          if (audioPart?.inlineData) {
              audioPart.inlineData.data = '';
              audioPart.inlineData = null;
          }
          audioPart = null;
          requestOptions.contents = [];
          base64Data = '';
      }

      const firstFinishReason = lastResultObj?.candidates?.[0]?.finishReason;

      // Auto-recovery if no text was produced on first attempt (due to RECITATION, intro music, low volume, or decoder quirk)
      if (!fullText.trim() && firstFinishReason !== 'SAFETY' && firstFinishReason !== 'MAX_TOKENS') {
        console.warn(`Empty transcript on first attempt (finishReason: ${firstFinishReason}). Retrying with enhanced sensitivity...`);
        setCurrentStage(appLang === 'bn' 
          ? 'কণ্ঠস্বর গভীরভাবে শনাক্ত করতে বিকল্প মোডে পুনরায় চেষ্টা করা হচ্ছে...' 
          : 'Retrying with high-sensitivity speech detection...');
        try {
          let retryBlob = effectiveFile;
          let retryMime = effectiveMimeType;
          // If small file wasn't converted to WAV yet, convert and normalize gain now
          if (inputFile.size <= 1 * 1024 * 1024 && retryMime !== 'audio/wav') {
            const wavRetry = await convertAudioToWav(inputFile, 16000);
            if (wavRetry?.wavBlob) {
              retryBlob = wavRetry.wavBlob;
              retryMime = 'audio/wav';
            }
          }
          let retryBase64 = await blobToBase64(retryBlob);
          const retryAudioPart: any = {
            inlineData: {
              mimeType: retryMime,
              data: retryBase64
            }
          };
          try {
            const retryResp = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    retryAudioPart,
                    { 
                      text: "You are an assistive speech-to-text accessibility tool. Listen carefully through any intro music, background noise, or low-volume sections, and transcribe all spoken words and dialogue in this recording into Bengali (Bangla). Format with [MM:SS] **Speaker 1:** when speech occurs." 
                    }
                  ]
                }
              ],
              config: {
                systemInstruction: "You are a high-sensitivity speech-to-text transcriber for user audio accessibility. Faithfully write down everything spoken in the audio in Bengali script without summarizing or stopping early.",
                temperature: 0.25,
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
              }
            });
            const retryText = extractText(retryResp);
            if (retryText.trim()) {
              fullText = retryText;
              lastResultObj = retryResp;
            }
          } finally {
            if (retryAudioPart?.inlineData) {
              retryAudioPart.inlineData.data = '';
              retryAudioPart.inlineData = null;
            }
            retryBase64 = '';
          }
        } catch (retryErr) {
          console.warn("Adaptive retry failed:", retryErr);
        }
      }

      clearTranscriptionTimer();

      fullText = removeRepetitiveBlocks(fullText);

      const finishReason = lastResultObj?.candidates?.[0]?.finishReason;
      lastResultObj = null; // Release SDK response object from memory immediately

      let isNoSpeechDetected = false;
      if (!fullText.trim()) {
        if (finishReason === 'SAFETY') {
          throw new Error(appLang === 'bn' 
            ? 'এআই নিরাপত্তা নীতিমালার কারণে এই অডিওটির ট্রান্সক্রিপশন সম্পন্ন করা সম্ভব হয়নি।' 
            : 'Transcription was blocked by AI safety policy.');
        } else if (finishReason === 'RECITATION') {
          throw new Error(appLang === 'bn'
            ? 'অডিওটিতে থাকা বক্তব্য/উদ্ধৃতি কপিরাইট বা রিসিটেশন ফিল্টারে পড়েছে। অনুগ্রহ করে Settings থেকে অন্য কোনো মডেল (যেমন: Gemini 2.5 Flash বা 3.1 Lite) অথবা Normal মোড দিয়ে পুনরায় চেষ্টা করুন।'
            : 'Transcription was blocked due to copyright or recitation policies. Please select another model in Settings or try Normal mode.');
        } else if (finishReason === 'MAX_TOKENS') {
          throw new Error(appLang === 'bn'
            ? 'টোকেন লিমিট পূর্ণ হয়ে গেছে। অনুগ্রহ করে অডিও ফাইলটি ছোট করে পুনরায় চেষ্টা করুন।'
            : 'Token limit reached. Please use a shorter audio clip.');
        } else {
          isNoSpeechDetected = true;
          fullText = appLang === 'bn' 
            ? '[কোনো কথা বা কণ্ঠস্বর সনাক্ত করা যায়নি / No audible speech detected]' 
            : '[No audible speech detected in audio file]';
        }
      }

      const actualElapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      const fileName = (inputFile as File).name || inputMetadata.name || "audio_file";
      const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'mp3';
      const historyId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const historyItem = {
        id: historyId,
        fileName: fileName,
        date: new Date().toISOString(),
        publishedDate: inputMetadata.date,
        duration: inputMetadata.duration || '00:00',
        transcript: fullText,
        extension: fileExtension,
        timeTaken: `${actualElapsedSeconds}s`,
        channelName: inputMetadata.channelName,
        size: inputMetadata.size || `${(inputFile.size / (1024 * 1024)).toFixed(2)} MB`,
        bgbRemark: undefined
      };

      // Update all in-memory UI states TOGETHER in one batch at completion
      // so there is ZERO surprise full-app re-render wave 5-6.5 seconds later while reading/scrolling!
      if (!isNoSpeechDetected) {
        try {
          const { useHistoryStore } = await import('./useHistoryStore');
          const currentHistory = useHistoryStore.getState().history;
          useHistoryStore.getState().setHistory([historyItem, ...currentHistory]);
        } catch (e) {
          console.warn("In-memory history update notice:", e);
        }
      }

      await incrementTotalCalls('Transcription', modelName, checkProvider.source);
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

      // 2. Non-UI disk persistence only (does NOT mutate React state or trigger component re-renders)
      const runOnIdle = (task: () => Promise<void> | void, delayMs: number) => {
        setTimeout(() => {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => task(), { timeout: 2000 });
          } else {
            task();
          }
        }, delayMs);
      };

      runOnIdle(async () => {
        try {
          if (!isNoSpeechDetected) {
            await addToStore(STORES.HISTORY, historyItem);
            try {
              const { broadcastHistoryUpdate } = await import('./useBroadcastSync');
              broadcastHistoryUpdate();
            } catch (e) {}
          }
          logSystemActivity('TRANSCRIPTION', 'SUCCESS', 'File Transcribed', `File: ${fileName}`);
        } catch (e) {
          console.warn("Background history persistence notice:", e);
        }
      }, 1500);

      runOnIdle(async () => {
        try {
          if (uploadedFile?.name) {
            try {
              await ai.files.delete({ name: uploadedFile.name });
            } catch (err) {
              console.warn("Could not delete file from Gemini server:", err);
            }
          }

          const isBgbAnalysisEnabled = localStorage.getItem('bgbAnalysisEnabled') === 'true';
          if (isBgbAnalysisEnabled && !isNoSpeechDetected) {
            const { getSensitiveKeywords } = await import('../utils/sensitiveKeywords');
            const { analyzeTranscriptForBgb } = await import('../services/bgbAnalysisService');
            const keywords = getSensitiveKeywords();
            const lower = fullText.toLowerCase();
            const matches = keywords.filter((kw: string) => lower.includes(kw.toLowerCase()));
            if (matches.length > 0) {
              const result = await analyzeTranscriptForBgb(fullText, matches);
              if (result?.remark) {
                historyItem.bgbRemark = result.remark as any;
                await addToStore(STORES.HISTORY, historyItem);
              }
            }
          }
        } catch (e) {
          console.warn("Background cleanup & analysis notice:", e);
        }
      }, 4000);

      return { success: true, text: fullText };
    } catch (error: any) {
      console.error("Transcription Error:", error);
      setStatus('error');
      const safeMsg = formatErrorMessage(error, appLang);
      setErrorMessage(safeMsg);
      logSystemActivity('TRANSCRIPTION', 'ERROR', 'Failed', safeMsg);
      return { success: false, error: safeMsg };
    } finally {
      clearTranscriptionTimer();
      setProgress(100);
    }
  };

  return {
    ...state,
    processTranscription
  };
};
