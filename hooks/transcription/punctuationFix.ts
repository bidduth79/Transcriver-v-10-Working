// "Fix punctuation": a finished transcript is sent back to Gemini as text (no audio, so the requests are small)
// to add দাঁড়ি, commas and question marks. Gemini may change only punctuation: every line that comes back is
// checked against the original (the time, the speaker, and every letter and digit in order) and is used only
// when they all match; otherwise the original line stays. Latin digits in the words become Bengali digits by a
// fixed rule, without asking Gemini; the times keep theirs, since the app reads them.
import { PUNCTUATION_SYSTEM_INSTRUCTION } from '../../constants/instructions';
import { createGeminiClient } from '../../services/apiKeys/geminiClient';
import { extractResponseText, buildThinkingConfig } from './geminiRequest';

// Lines sent per request: a 44-minute talk show is about three requests
const MAX_CHUNK_CHARS = 15000;
// Writing out a long chunk takes a while
const CHUNK_TIMEOUT_MS = 4 * 60 * 1000;
const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';

// "[12:30] **Name:** " at the start of a line
const HEAD = /^(\s*[[(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\])]\s*(?:\*\*[^*]+\*\*)?\s*)/;
const headOf = (line: string) => line.match(HEAD)?.[1] ?? '';
const wordsOf = (line: string) => line.slice(headOf(line).length);
// Letters and digits only, digits in one form: what must not change
const lettersOf = (text: string) =>
  text.normalize('NFC').replace(/[০-৯]/g, d => String(BENGALI_DIGITS.indexOf(d))).replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const sameHead = (a: string, b: string) => headOf(a).replace(/\s+/g, ' ').trim() === headOf(b).replace(/\s+/g, ' ').trim();

// Latin digits in the words become Bengali; anything in brackets (times, [অস্পষ্ট]) is kept as it is
export const bengaliDigits = (text: string) =>
  text.split('\n').map(line => {
    const head = headOf(line);
    return head + line.slice(head.length).replace(/(\[[^\]]*\])|[0-9]/g, (match, bracket) => bracket ?? BENGALI_DIGITS[Number(match)]);
  }).join('\n');

// The line Gemini gave, if only its punctuation differs: with the original time and speaker, byte for byte
export const acceptedLine = (original: string, fixed: string | undefined): string | null => {
  if (fixed === undefined || !sameHead(original, fixed)) return null;
  if (lettersOf(wordsOf(original)) !== lettersOf(wordsOf(fixed))) return null;
  return headOf(original) + wordsOf(fixed).trim();
};

interface NumberedLine { line: string; index: number }

const chunksOf = (lines: NumberedLine[]) => {
  const chunks: NumberedLine[][] = [];
  let current: NumberedLine[] = [];
  let size = 0;
  for (const item of lines) {
    if (current.length > 0 && size + item.line.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.line.length + 1;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

export interface PunctuationResult {
  text: string;
  // Lines whose punctuation was changed, and lines kept as they were because Gemini changed more than that
  changedLines: number;
  keptLines: number;
  requests: number;
}

export const fixPunctuation = async (transcript: string, apiKey: string, model: string): Promise<PunctuationResult> => {
  const lines = bengaliDigits(transcript).split('\n');
  const spoken = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.trim());
  const ai = await createGeminiClient(apiKey);
  const thinkingConfig = buildThinkingConfig(model);
  let changedLines = 0;
  let keptLines = 0;
  let requests = 0;
  for (const chunk of chunksOf(spoken)) {
    requests++;
    const response = await ai.models.generateContent({
      model,
      contents: chunk.map(item => item.line).join('\n'),
      config: { systemInstruction: PUNCTUATION_SYSTEM_INSTRUCTION, timeoutMs: CHUNK_TIMEOUT_MS, ...(thinkingConfig ? { thinkingConfig } : {}) },
    });
    const answer = extractResponseText(response).split('\n').filter(line => line.trim());
    // Lines that do not pair up one to one cannot be checked: the whole chunk stays as it was
    if (answer.length !== chunk.length) {
      keptLines += chunk.length;
      continue;
    }
    chunk.forEach(({ line, index }, i) => {
      const fixed = acceptedLine(line, answer[i]);
      if (fixed === null) keptLines++;
      else if (fixed !== line) {
        lines[index] = fixed;
        changedLines++;
      }
    });
  }
  return { text: lines.join('\n'), changedLines, keptLines, requests };
};
