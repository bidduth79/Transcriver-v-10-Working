// Moves every [MM:SS] / [H:MM:SS] (or round-bracket, or Bengali-digit) timestamp in a chunk's transcript
// forward by the chunk's start, so the parts of a long recording read as one transcript

const TIMESTAMP = /([[(])((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})([\])])/g;
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const pad = (n: number) => n.toString().padStart(2, '0');

export const formatClock = (total: number) => {
  const hours = Math.floor(total / 3600);
  const mins = Math.floor(total / 60) % 60;
  return hours > 0 ? `${hours}:${pad(mins)}:${pad(total % 60)}` : `${pad(mins)}:${pad(total % 60)}`;
};

export const shiftTimestamps = (text: string, offsetSeconds: number) => {
  const offset = Math.round(offsetSeconds);
  if (offset <= 0) return text;
  return text.replace(TIMESTAMP, (_match, open: string, clock: string, close: string) => {
    const seconds = toLatinDigits(clock).split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);
    return `${open}${formatClock(seconds + offset)}${close}`;
  });
};
