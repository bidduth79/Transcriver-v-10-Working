import type { HarmCategory, HarmBlockThreshold, ThinkingLevel, Part, GenerateContentConfig, GenerateContentParameters, ThinkingConfig } from "@google/genai";
import { getModelDefinition, isSpeedOptimizationEnabled } from '../../services/ApiKeyManager';
import { TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT, TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL, TRANSCRIPTION_PROMPT_TEXT_NORMAL } from '../../constants/instructions';
import { isTranscribeModel, TRANSCRIBE_HTTP_OPTIONS, formatAudioTranscription } from './transcribeModel';

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_HATE_SPEECH' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
];

// Low, so the model writes what it hears instead of filling unclear parts with likely-sounding words.
// (Google suggests 1.0 for Gemini 3, mainly against looping; repeated blocks are removed afterwards.)
const TRANSCRIPTION_TEMPERATURE = 0.35;

// Speech-only transcribe models reject written instructions ("Developer instruction is not enabled for
// this model") and do not follow them, so they get only the audio plus their diarization settings
const buildAudioRequest = (model: string, audioPart: Part, text: string, config: GenerateContentConfig): GenerateContentParameters => {
  if (isTranscribeModel(model)) {
    const { systemInstruction: _ignored, ...rest } = config;
    return {
      model,
      contents: [{ role: 'user', parts: [audioPart] }],
      config: { ...rest, httpOptions: TRANSCRIBE_HTTP_OPTIONS, safetySettings: SAFETY_SETTINGS }
    };
  }
  return {
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
  };
};

// Optional thinkingConfig for Fast/Balanced models when Speed Boost is enabled
// Also used by the short AI analyses (search analysis, report, BGB), which do not need deep thinking
export const buildThinkingConfig = (modelName: string): ThinkingConfig | undefined => {
  if (!isSpeedOptimizationEnabled() || getModelDefinition(modelName).category === 'thinking') return undefined;
  if (modelName.startsWith('gemini-3') && !modelName.includes('transcribe')) return { thinkingLevel: 'LOW' as ThinkingLevel };
  return undefined;
};

export const buildTranscriptionRequest = (
  modelName: string,
  mode: 'normal' | 'pro',
  audioPart: Part
): GenerateContentParameters => {
  const systemInstruction = mode === 'normal' ? TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL : TRANSCRIPTION_SYSTEM_INSTRUCTION;
  const promptText = mode === 'normal' ? TRANSCRIPTION_PROMPT_TEXT_NORMAL : TRANSCRIPTION_PROMPT_TEXT;
  const thinkingConfig = buildThinkingConfig(modelName);
  return buildAudioRequest(modelName, audioPart, promptText, {
    systemInstruction,
    temperature: TRANSCRIPTION_TEMPERATURE,
    ...(thinkingConfig ? { thinkingConfig } : {}),
  });
};

// Drop the large base64 audio payload from memory as soon as the request is done
// Only the parts of a request this touches; `contents` is always a list in this app's requests
type ReleasableRequest = { contents?: { parts?: { inlineData?: { data?: string } | null }[] }[] };

export const releaseRequestAudio = (request: object | null | undefined) => {
  const req = request as ReleasableRequest | null | undefined;
  for (const content of req?.contents || []) {
    for (const part of content?.parts || []) {
      if (part?.inlineData) {
        part.inlineData.data = '';
        part.inlineData = null;
      }
    }
  }
  if (req) req.contents = [];
};

type ResponseLike = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; text?: unknown };

export const extractResponseText = (response: unknown): string => {
  const resp = response as ResponseLike | null | undefined;
  if (!resp) return '';
  const transcription = formatAudioTranscription(resp);
  if (transcription !== null) return transcription;
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
