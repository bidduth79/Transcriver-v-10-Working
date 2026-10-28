// Speech-only Gemini models (e.g. gemini-3.5-transcribe). They ignore written instructions and answer
// with `audioTranscription` parts in the spoken language, so speaker turns and times come from the
// model's own diarization and word timestamps, formatted here like the app's normal transcripts.

export const isTranscribeModel = (model: string) => model.includes('transcribe');

// A transcribe model takes at most 98,304 input tokens, and audio is 32 tokens a second (about 51 minutes).
// Longer audio goes to the general model, which takes over a million tokens; the margin is for rounding.
export const TRANSCRIBE_MAX_SECONDS = 48 * 60;
export const LONG_AUDIO_MODEL = 'gemini-3.8-flash';

export const modelForAudioLength = (model: string, audioSeconds: number) =>
  isTranscribeModel(model) && audioSeconds > TRANSCRIBE_MAX_SECONDS ? LONG_AUDIO_MODEL : model;

// Sent through the SDK's extraBody: the SDK has no typed field for it yet
export const TRANSCRIBE_HTTP_OPTIONS = {
  extraBody: { generationConfig: { audioTranscriptionConfig: { diarization: true, wordTimestamp: true } } },
};

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
 * audioTranscription parts. Speakers are numbered in the order they first speak.
 */
export const formatAudioTranscription = (resp: unknown): string | null => {
  const parts = (resp as { candidates?: { content?: { parts?: { audioTranscription?: TranscriptionSegment }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  const segments = (parts ?? []).map(part => part?.audioTranscription).filter((s): s is TranscriptionSegment => !!s);
  if (segments.length === 0) return null;

  const speakers = new Map<string, number>();
  return segments
    .filter(segment => segment.text?.trim())
    .map(segment => {
      const label = segment.speakerLabel ?? '';
      if (!speakers.has(label)) speakers.set(label, speakers.size + 1);
      return `${formatOffset(segment.words?.[0]?.startOffset)} **Speaker ${speakers.get(label)}:** ${segment.text!.trim()}`;
    })
    .join('\n');
};
