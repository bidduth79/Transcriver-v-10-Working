// Pure builders for transcript export files (TXT, SRT); Word is in docxExport.ts

const TIMESTAMP_REGEX = /([\[\(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\]\)])/g;

// Put every [MM:SS] / (MM:SS) / [H:MM:SS] timestamp on its own line
export const normalizeTimestamps = (transcript: unknown): string =>
  ((typeof transcript === 'string' ? transcript : '') || '').replace(TIMESTAMP_REGEX, '\n$1').trim();

export const baseFileName = (fileName: unknown): string =>
  fileName && typeof fileName === 'string' ? fileName.split('.')[0] : 'transcript';

export const buildKeywordRegex = (matches: unknown): RegExp | null => {
  if (!matches || !Array.isArray(matches) || matches.length === 0) return null;
  const validMatches = matches
    .filter((m: string) => m && typeof m === 'string' && m.trim() !== '')
    .map((m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return validMatches.length > 0 ? new RegExp(`(${validMatches.join('|')})`, 'gi') : null;
};

export const buildTxtBlob = (transcript: unknown) => {
  let safeTranscript = transcript || '';
  if (typeof safeTranscript === 'string') {
    safeTranscript = normalizeTimestamps(safeTranscript);
  }
  return new Blob([String(safeTranscript)], { type: 'text/plain;charset=utf-8' });
};

const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, m => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(m)]);
const pad = (n: number) => n.toString().padStart(2, '0');

// [MM:SS], (MM:SS), [H:MM:SS] or (H:MM:SS) at the start of a cue line, and a **Speaker:** / **Speaker**: label
const CUE_TIME_REGEX = /[\[\(](?:([0-9০-৯]{1,2}):)?([0-9০-৯]{1,2}):([0-9০-৯]{2})[\]\)]\s*/;
const SPEAKER_LABEL_REGEX = /\*\*[^*]*?(?::\*\*|\*\*:)\s*/;
const srtTime = (total: number) => `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)},000`;

// One cue per line, each lasting 5 seconds from its timestamp (lines without one start at 00:00)
export const buildSrtBlob = (transcript: unknown) => {
  let srtContent = "";
  // A paragraph without its own time continues the timed subtitle before it (a transcript without any times is unchanged)
  const lines = normalizeTimestamps(transcript).split('\n').filter((l: string) => l && typeof l === 'string' && l.trim() !== "")
    .reduce<string[]>((cues, line) => {
      const previous = cues[cues.length - 1];
      if (previous !== undefined && CUE_TIME_REGEX.test(previous) && !CUE_TIME_REGEX.test(line)) cues[cues.length - 1] += ` ${line.trim()}`;
      else cues.push(line);
      return cues;
    }, []);
  lines.forEach((line: string, index: number) => {
    const timeMatch = line.match(CUE_TIME_REGEX);
    const [hours, mins, secs] = timeMatch
      ? [timeMatch[1] || '0', timeMatch[2], timeMatch[3]].map(v => parseInt(toLatinDigits(v), 10))
      : [0, 0, 0];
    const start = hours * 3600 + mins * 60 + secs;

    srtContent += `${index + 1}\n`;
    srtContent += `${srtTime(start)} --> ${srtTime(start + 5)}\n`;
    srtContent += `${line.replace(CUE_TIME_REGEX, '').replace(SPEAKER_LABEL_REGEX, '').trim()}\n\n`;
  });
  return new Blob([srtContent], { type: 'text/srt;charset=utf-8' });
};
