// Helpers for asking Gemini about part of a transcript and reading a structured (JSON) answer

/**
 * The parts of a transcript around each occurrence of `term`, joined with "…", up to `maxChars`.
 * Long transcripts are not cut at the start, so a term that appears late is still analysed.
 * Falls back to the beginning of the transcript when the term does not occur.
 */
export const buildSearchContext = (transcript: string, term: string, maxChars = 12000, radius = 500) => {
  const needle = term.trim().toLowerCase();
  const lower = transcript.toLowerCase();
  const ranges: [number, number][] = [];
  for (let at = needle ? lower.indexOf(needle) : -1; at !== -1; at = lower.indexOf(needle, at + needle.length)) {
    const start = Math.max(0, at - radius);
    const end = Math.min(transcript.length, at + needle.length + radius);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1]) last[1] = end; else ranges.push([start, end]);
  }
  if (ranges.length === 0) return transcript.substring(0, maxChars);

  let out = '';
  for (const [start, end] of ranges) {
    const piece = transcript.substring(start, end).trim();
    if (out.length + piece.length + 3 > maxChars) break;
    out += (out ? ' … ' : '') + piece;
  }
  return out || transcript.substring(ranges[0][0], ranges[0][0] + maxChars);
};

// Reads a JSON object answer (tolerates a ```json fence); null when it is not valid JSON
export const parseJsonAnswer = (text: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
