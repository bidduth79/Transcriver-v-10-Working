// Speech-only Gemini models (e.g. gemini-3.5-transcribe). They ignore written instructions and answer
// with `audioTranscription` parts in the spoken language, so speaker turns and times come from the
// model's own diarization and word timestamps, formatted here like the app's normal transcripts.

export const isTranscribeModel = (model: string) => model.includes('transcribe');

// Google offers two ways, and the app's Pro/Normal switch picks one (both checked on real talk shows):
// - Pro, verbatim: speaker turns and word times, but every word as said and no punctuation at all;
// - Normal, smart: punctuation (দাঁড়ি, comma, ?), Bengali digits and cleaned-up text, but no speakers or times.
// Google's limits per request: 30 minutes with speakers and times, 1 hour in smart mode. Longer audio is cut off
// silently (a 54-minute talk show in verbatim stopped at 42:16 and wrote an earlier stretch again), and the app
// never swaps the model, so it warns before starting instead.
export const TRANSCRIBE_LIMIT_SECONDS = { pro: 30 * 60, normal: 60 * 60 };

// Sent through the SDK's extraBody: the SDK has no typed field for it yet
export const transcribeHttpOptions = (mode: 'normal' | 'pro') => ({
  extraBody: { generationConfig: { audioTranscriptionConfig: mode === 'pro' ? { diarization: true, wordTimestamp: true } : { mode: 'smart' } } },
});

interface TranscriptionSegment {
  text?: string;
  speakerLabel?: string;
  words?: { startOffset?: string }[];
}

const pad = (n: number) => n.toString().padStart(2, '0');

// "75.300s" -> [01:15]; after the first hour -> [1:01:15]
const formatOffset = (offset: string | undefined) => {
  const total = Math.floor(parseFloat(offset ?? '') || 0);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor(total / 60) % 60;
  return hours > 0 ? `[${hours}:${pad(mins)}:${pad(total % 60)}]` : `[${pad(mins)}:${pad(total % 60)}]`;
};

/**
 * "[MM:SS] **Speaker N:** text" lines from a transcribe model's answer, or null when the answer has no
 * audioTranscription parts. Speakers are numbered in the order they first speak. A smart answer has no speakers
 * or times: its text is kept as plain paragraphs.
 */
export const formatAudioTranscription = (resp: unknown): string | null => {
  const parts = (resp as { candidates?: { content?: { parts?: { audioTranscription?: TranscriptionSegment }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  const segments = (parts ?? []).map(part => part?.audioTranscription).filter((s): s is TranscriptionSegment => !!s);
  if (segments.length === 0) return null;
  const spoken = segments.filter(segment => segment.text?.trim());
  if (!spoken.some(segment => segment.speakerLabel || segment.words?.length)) {
    return spoken.map(segment => segment.text!.trim()).join('\n\n');
  }

  const speakers = new Map<string, number>();
  return spoken
    .map(segment => {
      const label = segment.speakerLabel ?? '';
      if (!speakers.has(label)) speakers.set(label, speakers.size + 1);
      return `${formatOffset(segment.words?.[0]?.startOffset)} **Speaker ${speakers.get(label)}:** ${segment.text!.trim()}`;
    })
    .join('\n');
};
