// Joining the rest of a transcript that stopped early (Gemini sometimes takes a long silence in the
// middle of a programme, such as a break, for the end of the audio)

const TIMESTAMP = /[[(]((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})[\])]/;
const toSeconds = (clock: string) =>
  clock.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);

// Seconds of the latest timestamp in the transcript, or null when it has none
export const lastTimestampSeconds = (text: string) => {
  let last: number | null = null;
  for (const match of text.matchAll(new RegExp(TIMESTAMP.source, 'g'))) {
    const seconds = toSeconds(match[1]);
    if (last === null || seconds > last) last = seconds;
  }
  return last;
};

// The transcript with the rest added; lines of the rest up to `afterSeconds` were already written and are left out
export const appendContinuation = (text: string, rest: string, afterSeconds: number) => {
  const lines = rest.split('\n');
  const start = lines.findIndex(line => {
    const match = line.match(TIMESTAMP);
    return match !== null && toSeconds(match[1]) > afterSeconds;
  });
  if (start === -1) return text;
  return `${text.trimEnd()}\n${lines.slice(start).join('\n').trim()}`;
};
