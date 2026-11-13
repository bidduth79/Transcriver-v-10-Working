import { splitLongParagraphs } from '../../../hooks/transcription/textCleanup';

const TIMESTAMP_REGEX = /^[\*\_\[\(\s]*((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})[\*\_\]\)\s]*\s+(.*)/;
const GENERIC_NAMES = ['speaker', 'male', 'female', 'unknown', 'host', 'guest', 'interviewer', 'interviewee', 'announcer', 'voice', 'person'];

const isProperName = (name: string) => {
  const lowerName = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const generic of GENERIC_NAMES) {
    if (lowerName.includes(generic)) return false;
  }
  if (/^\d+$/.test(lowerName)) return false;
  return true;
};

export interface ParsedPart {
  isSpeaker: boolean;
  textInside: string;
  cleanName: string;
}

export interface ParsedLine {
  timestamp: string;
  // The line's own time, or the last time above it (a split paragraph has none of its own)
  seekTime: string;
  parsedParts: ParsedPart[];
}

const parseParts = (content: string): ParsedPart[] =>
  content.split(/(\*\*.*?\*\*)/g).map((part: string) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const textInside = part.slice(2, -2);
      const hasColon = textInside.trim().endsWith(':');
      const cleanName = textInside.replace(/:$/, '').trim();
      const isGeneric = !isProperName(cleanName);
      const isSpeaker = cleanName.split(/\s+/).length <= 4 && (!isGeneric || hasColon);
      return { isSpeaker, textInside, cleanName };
    }
    return { isSpeaker: false, textInside: part, cleanName: '' };
  });

// A transcript split into display lines: timestamp, speaker name and text parts
export const parseTranscriptLines = (text: string): ParsedLine[] => {
  if (!text) return [];

  // Force a newline before any timestamp like [07:41] or (1:23:45) so that inline speakers get separated properly
  // Older transcripts may hold one huge paragraph; it is shown in readable pieces (the saved text is unchanged)
  const textWithNewlines = splitLongParagraphs(text).replace(/([\[\(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\]\)])/g, '\n$1');

  // A line without its own time (a split paragraph) seeks to the last time above it
  let lastTimestamp = '';
  return textWithNewlines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const timestampMatch = line.match(TIMESTAMP_REGEX);
      const timestamp = timestampMatch ? `[${timestampMatch[1]}]` : '';
      if (timestamp) lastTimestamp = timestamp;
      return { timestamp, seekTime: lastTimestamp, parsedParts: parseParts(timestampMatch ? timestampMatch[2] : line) };
    });
};
