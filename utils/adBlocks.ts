// Advertisement and promo blocks inside a transcript, wrapped by Gemini in AD_START / AD_END lines.
// They are folded on screen and left out of downloads, keyword matches and BGB analysis.
import { AD_START, AD_END } from '../constants/instructions';

const START = AD_START.normalize('NFC');
const END = AD_END.normalize('NFC');
const TIME = String.raw`[[(](?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}[\])]`;
const ONLY_TIME = new RegExp(String.raw`^[\s*_]*(?:${TIME})?[\s*_]*$`);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Each marker goes together with the time written just before it
const START_WITH_TIME = new RegExp(String.raw`(?:${TIME}\s*)?${escapeRegExp(START)}`);
const END_WITH_TIME = new RegExp(String.raw`(?:${TIME}\s*)?${escapeRegExp(END)}`);

export type AdMarker = 'start' | 'end';

// Which marker a line holds, and the line without it ('' when only its time is left)
export const readAdMarker = (line: string): { marker: AdMarker | null; rest: string } => {
  const text = line.normalize('NFC');
  const marker: AdMarker | null = text.includes(START) ? 'start' : text.includes(END) ? 'end' : null;
  if (!marker) return { marker, rest: line };
  const rest = text.replace(marker === 'start' ? START_WITH_TIME : END_WITH_TIME, '').trim();
  return { marker, rest: ONLY_TIME.test(rest) ? '' : rest };
};

// The transcript without its advertisement blocks (a block left open runs to the end)
export const withoutAds = (text: string) => {
  if (!text || !text.normalize('NFC').includes(START)) return text;
  const kept: string[] = [];
  let inAd = false;
  for (const line of text.split('\n')) {
    const { marker, rest } = readAdMarker(line);
    if (marker === 'start') inAd = true;
    else if (marker === 'end') inAd = false;
    // Text after an end marker is the programme again
    if (marker === 'end' ? rest : !inAd && !marker) kept.push(marker ? rest : line);
  }
  return kept.join('\n');
};
