import { useState, useMemo } from 'react';
import { GenerateContentResponse, Type } from "@google/genai";
import { getActiveProvider, incrementTotalCalls } from '../../../services/ApiKeyManager';
import { logSystemActivity } from '../../../services/SystemLogger';
import { createGeminiClient } from '../../../services/apiKeys/geminiClient';
import { buildSearchContext, parseJsonAnswer } from '../../../utils/aiAnswer';
import { buildThinkingConfig } from '../../../hooks/transcription/geminiRequest';
import { messageOf } from '../../../utils/errorMessage';
import type { FileMeta } from '../../../types';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

export interface AiAnalysis { sentiment: 'positive' | 'negative' | 'neutral'; remark: string }

// Where and how often the search term occurs in the open transcript
export interface SummaryStats {
  searchTerm: string;
  fileName: string;
  duration: string;
  matchCount: number;
  matchTimestamps: string[];
  matchSentences: string[];
}

export function useSummaryAnalysis(
  searchTerm: string, 
  transcript: string, 
  appLang: 'en' | 'bn', 
  addToast: (msg: string, type: ToastType) => void,
  setIsAiLoading?: (loading: boolean) => void,
  onModelUpdate?: () => void
) {
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const performAIAnalysis = async () => {
    if (!searchTerm || !transcript || isAnalyzing) return;
    setIsAnalyzing(true);
    if (setIsAiLoading) setIsAiLoading(true);
    setAiAnalysis(null);

    const executeAnalysis = async (): Promise<string | undefined> => {
      const provider = await getActiveProvider();
      if (!provider) {
          throw new Error("No Active API Key Selected. Please select one in Settings.");
      }

      const ai = createGeminiClient(provider.key);
      const prompt = `Analyze the context of the word/phrase "${searchTerm}" in this transcript.
      Task:
      1. Determine if the discussion about "${searchTerm}" is Positive, Negative, or Neutral.
      2. Write a short 1-sentence explanation in Bengali.
      
      Format your response EXACTLY like this:
      SENTIMENT: [Positive/Negative/Neutral]
      REMARK: [Explanation in Bengali]
      
      Transcript segment: ${buildSearchContext(transcript, searchTerm)}`;
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: provider.model,
        contents: prompt,
        // A fixed JSON shape, so the answer can always be read
        config: {
          ...(buildThinkingConfig(provider.model) ? { thinkingConfig: buildThinkingConfig(provider.model) } : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { sentiment: { type: Type.STRING, enum: ['Positive', 'Negative', 'Neutral'] }, remark: { type: Type.STRING } },
            required: ['sentiment', 'remark'],
          },
        },
      });
      await incrementTotalCalls('সার্চ এনালাইসিস', provider.model, provider.source);
      if (onModelUpdate) onModelUpdate();
      return response.text;
    };

    try {
      const raw = await executeAnalysis() || "";
      const json = parseJsonAnswer(raw);
      const text = json ? `SENTIMENT: ${json.sentiment}\nREMARK: ${json.remark}` : raw;
      const sentimentMatch = text.match(/SENTIMENT:\s*(Positive|Negative|Neutral|ইতিবাচক|নেতিবাচক|নিউট্রাল)/i);
      const remarkMatch = text.match(/REMARK:\s*(.*)/i);
      
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (sentimentMatch) {
        const s = sentimentMatch[1].toLowerCase();
        if (s.includes('positive') || s.includes('ইতিবাচক')) sentiment = 'positive';
        else if (s.includes('negative') || s.includes('নেতিবাচক')) sentiment = 'negative';
      }

      const remark = remarkMatch ? remarkMatch[1].trim() : (uiText(appLang, 'analysisComplete'));
      setAiAnalysis({ sentiment, remark });
      
      // Log Success
      logSystemActivity('ANALYSIS', 'SUCCESS', 'Sentiment Analysis Completed', `Term: ${searchTerm}, Sentiment: ${sentiment}`);
      
      addToast(uiText(appLang, 'aiAnalysisSuccessful'), 'success');
    } catch (error) {
      console.error("AI Analysis Error:", error);
      
      // Log Error
      logSystemActivity('ANALYSIS', 'ERROR', 'Analysis Failed', `Error: ${messageOf(error)}`);
      
      const quotaMsg = uiText(appLang, 'apiKeyErrorOrQuotaExceeded');
      
      const errorMsg = messageOf(error)?.includes('429') || messageOf(error)?.includes('403') ? quotaMsg : (uiText(appLang, 'aiAnalysisFailed'));
      addToast(errorMsg, 'error');
    } finally {
      setIsAnalyzing(false);
      if (setIsAiLoading) setIsAiLoading(false);
    }
  };

  return { aiAnalysis, setAiAnalysis, isAnalyzing, performAIAnalysis };
}

export function useSummaryStats(searchTerm: string, transcript: string, fileMeta: Partial<FileMeta>) {
  const currentStats = useMemo((): SummaryStats | null => {
    if (!searchTerm || !transcript) return null;
    const lowerSearch = searchTerm.toLowerCase().trim();
    if (lowerSearch === "") return null;

    const lines = transcript.split('\n');
    const turns: { startTime: string, text: string }[] = [];
    let currentTurnText = "";
    let lastKnownTime = "00:00";

    lines.forEach((line) => {
      const timeMatch = line.match(/\[([0-9০-৯]{1,2}:[0-9০-৯]{2})\]/);
      if (timeMatch) {
        if (currentTurnText.trim()) turns.push({ startTime: lastKnownTime, text: currentTurnText });
        lastKnownTime = timeMatch[1];
        currentTurnText = line; 
      } else {
        currentTurnText += " " + line;
      }
    });
    if (currentTurnText.trim()) turns.push({ startTime: lastKnownTime, text: currentTurnText });

    const ranges: string[] = [];
    const snippets: string[] = [];
    
    turns.forEach((turn, index) => {
      const cleanText = turn.text
        .replace(/\*\*.*?\*\*/g, '')
        .replace(/\[[0-9০-৯]{1,2}:[0-9০-৯]{2}\]/g, '')
        .replace(/Speaker \d+\s*:/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
        
      const turnContent = cleanText.toLowerCase();
      const startTime = turn.startTime;
      const endTime = turns[index + 1]?.startTime || fileMeta?.duration || "...";
      
      let pos = turnContent.indexOf(lowerSearch);
      while (pos !== -1) {
        ranges.push(`${startTime} - ${endTime}`);
        
        const beforeMatch = cleanText.substring(0, pos);
        const lastPunc = Math.max(
            beforeMatch.lastIndexOf('।'),
            beforeMatch.lastIndexOf('.'),
            beforeMatch.lastIndexOf('?'),
            beforeMatch.lastIndexOf('!'),
            beforeMatch.lastIndexOf('|')
        );
        const idealStartSnip = lastPunc === -1 ? 0 : lastPunc + 1;

        const afterMatch = cleanText.substring(pos + lowerSearch.length);
        const puncs = ['।', '.', '?', '!', '|'];
        let firstPunc = -1;
        for (const p of puncs) {
            const idx = afterMatch.indexOf(p);
            if (idx !== -1) {
                if (firstPunc === -1 || idx < firstPunc) {
                    firstPunc = idx;
                }
            }
        }
        const idealEndSnip = firstPunc === -1 ? cleanText.length : pos + lowerSearch.length + firstPunc + 1;
        const startSnip = Math.max(idealStartSnip, pos - 150);
        const endSnip = Math.min(idealEndSnip, pos + lowerSearch.length + 150);
        
        let snip = cleanText.substring(startSnip, endSnip).trim();
        if (startSnip > idealStartSnip) snip = "..." + snip;
        if (endSnip < idealEndSnip) snip = snip + "...";
        snippets.push(snip);
        pos = turnContent.indexOf(lowerSearch, pos + lowerSearch.length);
      }
    });

    return {
      searchTerm,
      fileName: fileMeta?.name || 'Unknown',
      duration: fileMeta?.duration || '00:00',
      matchCount: ranges.length,
      matchTimestamps: ranges,
      matchSentences: snippets
    };
  }, [transcript, searchTerm, fileMeta]);

  return currentStats;
}
