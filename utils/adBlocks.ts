// Advertisement and promo blocks inside a transcript, wrapped by Gemini in AD_START / AD_END marks.
// Only a block that looks like a real advertisement break is folded on screen and left out of downloads, keyword
// matches and BGB analysis: it is closed, and short. A block that is never closed, or that is longer than an
// advertisement break, comes from a missing or misplaced mark (in saved transcripts such blocks hid up to 97% of
// a programme), so its words stay in the programme: showing an advert is better than hiding the talk.
import { AD_START, AD_END } from '../constants/instructions';
import { TIMESTAMP_SOURCE, clockToSeconds, timestampsIn } from './transcriptTimes';

const START = AD_START.normalize('NFC');
const END = AD_END.normalize('NFC');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A mark together with the time written just before it (the clock is group 1, the mark group 2)
const MARK = new RegExp(String.raw`(?:${TIMESTAMP_SOURCE}\s*)?(${escapeRegExp(START)}|${escapeRegExp(END)})`, 'g');
// What is left beside a mark when only a time or bold stars remain
const ONLY_TIME = new RegExp(String.raw`^[\s*_]*(?:${TIMESTAMP_SOURCE})?[\s*_]*$`);

// The longest block folded: advertisement breaks last minutes; a longer block is a missing or misplaced mark
export const MAX_AD_SECONDS = 6 * 60;
// The most text folded, also for blocks whose times do not tell (a few minutes of spoken adverts)
export const MAX_AD_CHARS = 3000;

// Time span of each folded block, e.g. { from: '[15:32]', to: '[17:10]' } ('' when unknown)
export interface AdRange {
  from: string;
  to: string;
}

// The transcript in order: words of the programme or of a folded block, and where each block's fold line goes
export type AdEntry =
  | { kind: 'text'; text: string; block: number | null }
  | { kind: 'fold'; block: number };

type Piece = { kind: 'text'; text: string } | { kind: 'start' | 'end'; clock: string | null };

interface Block {
  from: string;
  fromSeconds: number | null;
  to: string;
  toSeconds: number | null;
  // The latest time written inside the block
  lastInside: number | null;
  chars: number;
  closed: boolean;
}

// A line cut at its marks; a line without marks is kept exactly as it is
const piecesOf = (line: string): Piece[] => {
  const text = line.normalize('NFC');
  if (!text.includes(START) && !text.includes(END)) return [{ kind: 'text', text: line }];
  const pieces: Piece[] = [];
  const words = (part: string) => {
    const trimmed = part.trim();
    if (trimmed && !ONLY_TIME.test(trimmed)) pieces.push({ kind: 'text', text: trimmed });
  };
  let at = 0;
  for (const match of text.matchAll(MARK)) {
    words(text.slice(at, match.index));
    pieces.push({ kind: match[2] === START ? 'start' : 'end', clock: match[1] ?? null });
    at = match.index + match[0].length;
  }
  words(text.slice(at));
  return pieces;
};

const isAdBreak = (block: Block) =>
  block.closed && block.chars <= MAX_AD_CHARS &&
  (block.fromSeconds === null || block.toSeconds === null || block.toSeconds - block.fromSeconds <= MAX_AD_SECONDS);

/**
 * The transcript's lines as programme words, words of folded advertisement breaks and fold lines, with the time
 * span of each fold. Text before a start mark and after an end mark on the same line belongs to the programme; a
 * new start mark also ends a block left open (a missing end mark between two adverts).
 */
export const markAdBreaks = (lines: string[]): { entries: AdEntry[]; ranges: AdRange[] } => {
  const items: ({ kind: 'text'; text: string; block: number | null } | { kind: 'start'; block: number })[] = [];
  const blocks: Block[] = [];
  let open: number | null = null;
  let latest: { clock: string; seconds: number } | null = null;

  const endOpenBlock = (clock: string | null) => {
    if (open === null) return;
    const block = blocks[open];
    block.closed = true;
    block.to = clock ? `[${clock}]` : '';
    block.toSeconds = clock ? clockToSeconds(clock) : block.lastInside;
    open = null;
  };

  for (const line of lines) {
    for (const piece of piecesOf(line)) {
      if (piece.kind === 'text') {
        const times = timestampsIn(piece.text);
        if (times.length) latest = times[times.length - 1];
        if (open !== null) {
          blocks[open].chars += piece.text.length;
          if (times.length && latest) blocks[open].lastInside = latest.seconds;
        }
        items.push({ kind: 'text', text: piece.text, block: open });
        continue;
      }
      if (piece.kind === 'end' && open === null) continue; // an end without a start has nothing to fold
      endOpenBlock(piece.clock);
      if (piece.clock) latest = { clock: piece.clock, seconds: clockToSeconds(piece.clock) };
      if (piece.kind === 'start') {
        open = blocks.length;
        blocks.push({
          from: latest ? `[${latest.clock}]` : '', fromSeconds: latest?.seconds ?? null,
          to: '', toSeconds: null, lastInside: null, chars: 0, closed: false,
        });
        items.push({ kind: 'start', block: open });
      }
    }
  }

  const folds = new Map<number, number>();
  const ranges: AdRange[] = [];
  blocks.forEach((block, i) => {
    if (!isAdBreak(block)) return;
    folds.set(i, ranges.length);
    ranges.push({ from: block.from, to: block.to });
  });
  const entries: AdEntry[] = [];
  for (const item of items) {
    const fold = item.block === null ? undefined : folds.get(item.block);
    if (item.kind === 'text') entries.push({ kind: 'text', text: item.text, block: fold ?? null });
    else if (fold !== undefined) entries.push({ kind: 'fold', block: fold });
  }
  return { entries, ranges };
};

// The transcript without its advertisement breaks
export const withoutAds = (text: string) => {
  if (!text || !text.normalize('NFC').includes(START)) return text;
  return markAdBreaks(text.split('\n')).entries
    .flatMap(entry => (entry.kind === 'text' && entry.block === null ? [entry.text] : []))
    .join('\n');
};
