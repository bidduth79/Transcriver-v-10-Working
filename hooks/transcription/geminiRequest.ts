import type { HarmCategory, HarmBlockThreshold, ThinkingLevel, Part, GenerateContentConfig, GenerateContentParameters, ThinkingConfig } from "../../types/gemini";
import { getModelDefinition, isSpeedOptimizationEnabled } from '../../services/ApiKeyManager';
import { TRANSCRIPTION_SYSTEM_INSTRUCTION, TRANSCRIPTION_PROMPT_TEXT, TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL, TRANSCRIPTION_PROMPT_TEXT_NORMAL, CONTINUATION_SYSTEM_INSTRUCTION, continuationPrompt, knownNamesNote } from '../../constants/instructions';
import { namesForPrompt } from '../../services/knownNames';
import { isTranscribeModel, transcribeHttpOptions, formatAudioTranscription } from './transcribeModel';

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_HATE_SPEECH' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as HarmCategory, threshold: 'BLOCK_NONE' as HarmBlockThreshold },
];

// No temperature is set: Gemini 3 models are tuned for their default (1.0), and Google warns that lower values can
// make them loop or degrade. Seen here too: the loops of November came at 0.35, and on the same 11-minute call 0.35
// gave one line while 1.0 gave 110 timed lines to the end, with the same text and no repeats. Guessed words are
// kept out by the instructions ([অস্পষ্ট] for what cannot be heard), not by a lowered temperature.

// Speech-only transcribe models reject written instructions ("Developer instruction is not enabled for
// this model") and do not follow them, so they get only the audio plus the transcription way of the mode
const buildAudioRequest = (model: string, mode: 'normal' | 'pro', audioPart: Part, text: string, config: GenerateContentConfig): GenerateContentParameters => {
  if (isTranscribeModel(model)) {
    const { systemInstruction: _ignored, ...rest } = config;
    return {
      model,
      contents: [{ role: 'user', parts: [audioPart] }],
      config: { ...rest, httpOptions: transcribeHttpOptions(mode), safetySettings: SAFETY_SETTINGS }
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

// How long to wait for a transcription of this many seconds of audio before trying again: about a quarter
// of its length plus two minutes, between 5 and 20 minutes (measured: a 66 minute talk took 5 minutes).
// Without a known length the client's 10 minute default applies.
export const transcriptionTimeoutMs = (audioSeconds: number) =>
  audioSeconds > 0 ? Math.min(20 * 60, Math.max(5 * 60, 120 + audioSeconds / 4)) * 1000 : undefined;

export const buildTranscriptionRequest = (
  modelName: string,
  mode: 'normal' | 'pro',
  audioPart: Part,
  cleanFallback = false,
  // "[26:35]" without brackets: transcribe only what comes after it
  continueFrom?: string
): GenerateContentParameters => {
  // The rest of a transcript gets instructions for that part only, never also "transcribe the whole recording"
  const instruction = mode === 'normal' ? TRANSCRIPTION_SYSTEM_INSTRUCTION_NORMAL
    : continueFrom ? CONTINUATION_SYSTEM_INSTRUCTION : TRANSCRIPTION_SYSTEM_INSTRUCTION;
  // The spelling of names that often come up in the user's programmes, when there are any
  const names = knownNamesNote(namesForPrompt());
  const systemInstruction = names ? `${instruction}\n\n${names}` : instruction;
  const promptText = continueFrom ? continuationPrompt(continueFrom) : mode === 'normal' ? TRANSCRIPTION_PROMPT_TEXT_NORMAL : TRANSCRIPTION_PROMPT_TEXT;
  if (cleanFallback) {
    return buildAudioRequest(modelName, mode, audioPart, promptText, { systemInstruction });
  }
  const thinkingConfig = buildThinkingConfig(modelName);
  return buildAudioRequest(modelName, mode, audioPart, promptText, {
    systemInstruction,
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
