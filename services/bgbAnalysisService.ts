import { BgbRemarkType, BgbAnalysisResult } from '../types/bgb';
import { getActiveProvider } from './ApiKeyManager';
import { DEFAULT_MODEL } from '../constants/aiModels';
import { Type } from '@google/genai';
import { createGeminiClient } from './apiKeys/geminiClient';
import { parseJsonAnswer } from '../utils/aiAnswer';
import { buildThinkingConfig } from '../hooks/transcription/geminiRequest';

export const analyzeTranscriptForBgb = async (transcript: string, sensitiveMatches: string[]): Promise<BgbAnalysisResult | null> => {
  if (!transcript || sensitiveMatches.length === 0) {
    return null;
  }

  try {
    const provider = await getActiveProvider();
    const apiKey = provider?.key;
    const modelToUse = provider?.model || DEFAULT_MODEL;
    if (!apiKey) {
      throw new Error('API Key missing');
    }

    const ai = createGeminiClient(apiKey);
    
    const prompt = `
      You are an intelligent transcript analyzer. 
      The following transcript contains sensitive words related to "BGB" (Border Guard Bangladesh) or border activities: ${sensitiveMatches.join(', ')}.
      
      Transcript:
      """
      ${transcript}
      """
      
      Please analyze the context (words before and after these sensitive words) to determine if the overall tone or action towards BGB (Border Guard Bangladesh) is Positive, Negative, or Neutral.
      Provide your response strictly in the following JSON format:
      {
        "remark": "Positive" | "Negative" | "Neutral",
        "details": "A short summary in Bengali (maximum 2-3 sentences) explaining why it is positive, negative, or neutral for BGB."
      }
      
      Only return the raw JSON object, without any markdown formatting, no backticks, no code blocks.
    `;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Default temperature (1.0), as Google recommends for Gemini 3 models
      config: {
        ...(buildThinkingConfig(modelToUse) ? { thinkingConfig: buildThinkingConfig(modelToUse) } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { remark: { type: Type.STRING, enum: ['Positive', 'Negative', 'Neutral'] }, details: { type: Type.STRING } },
          required: ['remark', 'details'],
        },
      }
    });

    const parsed: { remark?: BgbRemarkType; details?: string } = parseJsonAnswer(response.text || "{}") ?? {};

    return {
      remark: parsed.remark || 'Neutral',
      details: parsed.details || 'কোনো তথ্য পাওয়া যায়নি।'
    };
  } catch (error) {
    console.error("BGB Analysis Error:", error);
    return {
      remark: 'Neutral',
      details: 'এনালাইসিস করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।'
    };
  }
};
