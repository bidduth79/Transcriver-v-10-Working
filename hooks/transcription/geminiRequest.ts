import { HarmCategory, HarmBlockThreshold, ThinkingLevel, type Part } from "@google/genai";
import { getModelDefinition, isSpeedOptimizationEnabled } from '../../services/ApiKeyManager';
import { TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT, TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL, TRANSCRIPTION_PROMPT_TEXT_NORMAL } from '../../constants/instructions';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const HIGH_SENSITIVITY_PROMPT = "You are an assistive speech-to-text accessibility tool. Listen carefully through any intro music, background noise, or low-volume sections, and transcribe all spoken words and dialogue in this recording into Bengali (Bangla). Format with [MM:SS] **Speaker 1:** when speech occurs.";
const HIGH_SENSITIVITY_SYSTEM = "You are a high-sensitivity speech-to-text transcriber for user audio accessibility. Faithfully write down everything spoken in the audio in Bengali script without summarizing or stopping early.";

const buildAudioRequest = (model: string, audioPart: Part, text: string, config: any) => ({
  model,
  contents: [
    {
      role: 'user',
      parts: [
        audioPart,
        { text }
      ]
    }
  ],
  config: { ...config, safetySettings: SAFETY_SETTINGS }
});

// Optional thinkingConfig for Fast/Balanced models when Speed Boost is enabled
const buildThinkingConfig = (modelName: string): any => {
  if (!isSpeedOptimizationEnabled() || getModelDefinition(modelName).category === 'thinking') return undefined;
  if (modelName.startsWith('gemini-3') && !modelName.includes('transcribe')) return { thinkingLevel: ThinkingLevel.LOW };
  return undefined;
};

export const buildTranscriptionRequest = (
  modelName: string,
  mode: 'normal' | 'pro',
  audioPart: Part
): any => {
  const systemInstruction = mode === 'normal' ? TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL : TRANSCRIPTION_SYSTEM_INSTRUCTION;
  const promptText = mode === 'normal' ? TRANSCRIPTION_PROMPT_TEXT_NORMAL : TRANSCRIPTION_PROMPT_TEXT;
  const thinkingConfig = buildThinkingConfig(modelName);
  return buildAudioRequest(modelName, audioPart, promptText, {
    systemInstruction,
    temperature: 0.35,
    ...(thinkingConfig ? { thinkingConfig } : {}),
  });
};

export const buildHighSensitivityRequest = (modelName: string, audioPart: Part): any =>
  buildAudioRequest(modelName, audioPart, HIGH_SENSITIVITY_PROMPT, {
    systemInstruction: HIGH_SENSITIVITY_SYSTEM,
    temperature: 0.25,
  });

// Drop the large base64 audio payload from memory as soon as the request is done
export const releaseRequestAudio = (request: any) => {
  for (const content of request?.contents || []) {
    for (const part of content?.parts || []) {
      if (part?.inlineData) {
        part.inlineData.data = '';
        part.inlineData = null;
      }
    }
  }
  if (request) request.contents = [];
};

export const extractResponseText = (resp: any): string => {
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
