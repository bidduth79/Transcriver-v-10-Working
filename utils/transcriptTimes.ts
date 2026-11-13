// Timestamps in a transcript: [MM:SS] or [H:MM:SS], in square or round brackets, in Latin or Bengali digits

const CLOCK = String.raw`(?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2}`;

// One timestamp; its clock ("26:35") is group 1
export const TIMESTAMP_SOURCE = String.raw`[[(](${CLOCK})[\])]`;

// "26:35" or "১:০২:০৩" -> seconds
export const clockToSeconds = (clock: string) =>
  clock
    .replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
    .split(':')
    .map(Number)
    .reduce((sum, part) => sum * 60 + part, 0);

export interface TranscriptTime {
  clock: string;
  seconds: number;
  // Where the timestamp starts in the text
  index: number;
}

// Every timestamp in the text, in the order written
export const timestampsIn = (text: string): TranscriptTime[] =>
  [...text.matchAll(new RegExp(TIMESTAMP_SOURCE, 'g'))].map(match => ({
    clock: match[1],
    seconds: clockToSeconds(match[1]),
    index: match.index,
  }));
