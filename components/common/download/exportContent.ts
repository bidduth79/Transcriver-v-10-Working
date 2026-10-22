// Pure builders for transcript export files (TXT, Word, SRT)

const TIMESTAMP_REGEX = /([\[\(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\]\)])/g;

// Put every [MM:SS] / (MM:SS) / [H:MM:SS] timestamp on its own line
export const normalizeTimestamps = (transcript: any): string =>
  ((typeof transcript === 'string' ? transcript : '') || '').replace(TIMESTAMP_REGEX, '\n$1').trim();

export const baseFileName = (fileName: any): string =>
  fileName && typeof fileName === 'string' ? fileName.split('.')[0] : 'transcript';

export const buildKeywordRegex = (matches: any): RegExp | null => {
  if (!matches || !Array.isArray(matches) || matches.length === 0) return null;
  const validMatches = matches
    .filter((m: string) => m && typeof m === 'string' && m.trim() !== '')
    .map((m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return validMatches.length > 0 ? new RegExp(`(${validMatches.join('|')})`, 'gi') : null;
};

export const buildTxtBlob = (transcript: any) => {
  let safeTranscript = transcript || '';
  if (typeof safeTranscript === 'string') {
    safeTranscript = normalizeTimestamps(safeTranscript);
  }
  return new Blob([safeTranscript], { type: 'text/plain;charset=utf-8' });
};

export const buildWordBlob = (transcript: any, keywordRegex: RegExp | null) => {
  // Convert speaker tags for Word
  const processedTranscript = normalizeTimestamps(transcript).replace(/\*\*(.*?)\*\*/g, '<strong style="color: #4338ca;">$1</strong>');
  let htmlContent = processedTranscript.replace(/\n/g, '<br>');
  if (keywordRegex) {
    htmlContent = htmlContent.replace(keywordRegex, `<span style="background-color: #ef4444; color: white; font-weight: bold;">$1</span>`);
  }

  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Transcript</title><style>body { font-family: "Hind Siliguri", sans-serif; }</style></head><body>`;
  const footer = "</body></html>";
  return new Blob(['﻿', header + htmlContent + footer], { type: 'application/msword' });
};

const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, m => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(m)]);
const pad = (n: number) => n.toString().padStart(2, '0');

// One cue per line, each lasting 5 seconds from its [MM:SS] timestamp
export const buildSrtBlob = (transcript: any) => {
  let srtContent = "";
  const lines = normalizeTimestamps(transcript).split('\n').filter((l: string) => l && typeof l === 'string' && l.trim() !== "");
  lines.forEach((line: string, index: number) => {
    const timeMatch = line.match(/\[([0-9০-৯]{1,2}):([0-9০-৯]{2})\]/);
    let startMins = 0, startSecs = 0;
    if (timeMatch) {
      startMins = parseInt(toLatinDigits(timeMatch[1]), 10);
      startSecs = parseInt(toLatinDigits(timeMatch[2]), 10);
    }
    let endMins = startMins;
    let endSecs = startSecs + 5;
    if (endSecs >= 60) {
      endMins += Math.floor(endSecs / 60);
      endSecs = endSecs % 60;
    }
    const startHours = Math.floor(startMins / 60);
    const startRemMins = startMins % 60;
    const endHours = Math.floor(endMins / 60);
    const endRemMins = endMins % 60;

    srtContent += `${index + 1}\n`;
    srtContent += `${pad(startHours)}:${pad(startRemMins)}:${pad(startSecs)},000 --> ${pad(endHours)}:${pad(endRemMins)}:${pad(endSecs)},000\n`;
    srtContent += `${line.replace(/\*\*.*?\*\*:/, '').replace(/\[[0-9০-৯]{1,2}:[0-9০-৯]{2}\]\s*/, '').trim()}\n\n`;
  });
  return new Blob([srtContent], { type: 'text/srt;charset=utf-8' });
};
