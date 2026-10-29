import { splitLongParagraphs } from '../../../hooks/transcription/textCleanup';
import { readAdMarker } from '../../../utils/adBlocks';

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
  // Which advertisement block the line is in (numbered from 0), or null for the programme
  adBlock: number | null;
  // The line that opens a block, shown as its fold
  adStart: boolean;
}

// Time span of each advertisement block, e.g. { from: '[15:32]', to: '[17:10]' } ('' when unknown)
export interface AdRange {
  from: string;
  to: string;
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

// A transcript split into display lines: timestamp, speaker name and text parts, and advertisement blocks
export const parseTranscriptLines = (text: string): { lines: ParsedLine[]; adRanges: AdRange[] } => {
  if (!text) return { lines: [], adRanges: [] };

  // Force a newline before any timestamp like [07:41] or (1:23:45) so that inline speakers get separated properly
  // Older transcripts may hold one huge paragraph; it is shown in readable pieces (the saved text is unchanged)
  const textWithNewlines = splitLongParagraphs(text).replace(/([\[\(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\]\)])/g, '\n$1');

  const lines: ParsedLine[] = [];
  const adRanges: AdRange[] = [];
  let lastTimestamp = '';
  let openBlock: number | null = null;

  const addLine = (raw: string, adBlock: number | null) => {
    const timestampMatch = raw.match(TIMESTAMP_REGEX);
    const timestamp = timestampMatch ? `[${timestampMatch[1]}]` : '';
    if (timestamp) lastTimestamp = timestamp;
    lines.push({
      timestamp, seekTime: lastTimestamp, parsedParts: parseParts(timestampMatch ? timestampMatch[2] : raw),
      adBlock, adStart: false,
    });
  };

  for (const line of textWithNewlines.split('\n').map(l => l.trim()).filter(l => l.length > 0)) {
    const { marker, rest } = readAdMarker(line);
    const markerTime = line.match(TIMESTAMP_REGEX)?.[1];
    if (marker === 'start') {
      openBlock = adRanges.length;
      adRanges.push({ from: markerTime ? `[${markerTime}]` : lastTimestamp, to: '' });
      lines.push({ timestamp: '', seekTime: lastTimestamp, parsedParts: [], adBlock: openBlock, adStart: true });
      if (rest) addLine(rest, openBlock);
    } else if (marker === 'end' && openBlock !== null) {
      adRanges[openBlock].to = markerTime ? `[${markerTime}]` : '';
      openBlock = null;
      if (rest) addLine(rest, null);
    } else if (marker === 'end') {
      // An end without a start: nothing to fold
      if (rest) addLine(rest, null);
    } else {
      addLine(line, openBlock);
    }
  }
  return { lines, adRanges };
};
