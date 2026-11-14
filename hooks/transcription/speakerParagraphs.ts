// The transcript in the paragraphs the user asked for: a new paragraph when the speaker changes, and while one
// person keeps speaking, a new one about every five sentences. Gemini 3 at its default temperature writes a timed
// line every few sentences (229 lines for a 44-minute talk show), so consecutive lines of one speaker are joined
// here. Each paragraph keeps the time of its first line, so a click on it still plays the right place. No word
// is changed or lost.

const SENTENCES_PER_PARAGRAPH = 5;
// The length the viewer splits for reading (splitLongParagraphs): a joined paragraph stays below it. It also
// bounds lines without any punctuation (the transcribe model's verbatim mode).
const MAX_CHARS = 900;
// A longer silence between two lines of one speaker (a break, adverts) starts a new paragraph
const MAX_GAP_SECONDS = 90;

// "[12:30] **Name:** words" -> time, speaker and words
const TIMED_LINE = /^\s*[[(]((?:[0-9০-৯]{1,2}:)?[0-9০-৯]{1,2}:[0-9০-৯]{2})[\])]\s*\*\*([^*]+?)\*\*\s*(.*)$/;

const toSeconds = (clock: string) =>
  clock.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);

const sentencesIn = (text: string) => (text.match(/[।?!]+/g) || []).length;

interface Paragraph {
  line: string;
  // Empty for a paragraph that does not start with a time and speaker: nothing is joined to it
  speaker: string;
  sentences: number;
  lastSeconds: number;
}

export const joinSpeakerParagraphs = (text: string) => {
  const lines = text.split('\n');
  // A transcript without timed speaker lines (Normal mode) is left as it is
  if (!lines.some(line => TIMED_LINE.test(line))) return text;

  const paragraphs: string[] = [];
  let current: Paragraph | null = null;
  const close = () => {
    if (current) paragraphs.push(current.line);
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    const timed = line.match(TIMED_LINE);
    if (!timed) {
      // A line without its own time (e.g. a piece of a very long speech) continues the paragraph above it while
      // that has room; otherwise it starts a paragraph of its own, which later timed lines are never joined to
      const untimed: Paragraph | null = current;
      if (untimed && untimed.sentences < SENTENCES_PER_PARAGRAPH && untimed.line.length + line.trim().length + 1 <= MAX_CHARS) {
        untimed.line += ` ${line.trim()}`;
        untimed.sentences += sentencesIn(line);
      } else {
        close();
        current = { line: line.trim(), speaker: '', sentences: sentencesIn(line), lastSeconds: -1 };
      }
      continue;
    }
    const [, clock, name, words] = timed;
    const speaker = name.replace(/:$/, '').trim();
    const seconds = toSeconds(clock);
    const open: Paragraph | null = current;
    const joins = open !== null && open.speaker === speaker && open.sentences < SENTENCES_PER_PARAGRAPH
      && open.line.length + words.length + 1 <= MAX_CHARS && seconds - open.lastSeconds <= MAX_GAP_SECONDS;
    if (open && joins) {
      open.line += ` ${words.trim()}`;
      open.sentences += sentencesIn(words);
      open.lastSeconds = seconds;
    } else {
      close();
      current = { line: line.trim(), speaker, sentences: sentencesIn(words), lastSeconds: seconds };
    }
  }
  close();
  return paragraphs.join('\n');
};
