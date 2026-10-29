// Real speech gives hundreds of Bengali letters a minute. An answer with far fewer for long audio is not a transcript:
// Gemini once answered an 83-minute talk with one English sentence describing its own work.
const MIN_BENGALI_LETTERS_PER_MINUTE = 20;
const MIN_CHECKED_SECONDS = 120;

export const isNotATranscript = (text: string, audioSeconds: number) => {
  if (audioSeconds < MIN_CHECKED_SECONDS) return false;
  const letters = text.match(/[ঀ-৿]/g)?.length ?? 0;
  return letters < (audioSeconds / 60) * MIN_BENGALI_LETTERS_PER_MINUTE;
};
