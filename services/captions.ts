// YouTube's captions saved next to a recording in the watched folder: "<same name>.txt", a header (title, channel,
// link) and then timed lines. They are an outside yardstick of how much is said: a transcript with much less
// Bengali text than its captions has likely lost a part. Kept per file in memory only.
const captions = new WeakMap<Blob, string>();
// A captions file is small; anything bigger is not one
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

export const rememberCaption = (file: Blob, text: string) => captions.set(file, text);
export const captionOf = (file: Blob): string | null => captions.get(file) ?? null;

// Bengali letters in the captions' timed lines, without the times (written in Bengali digits) or the header
export const captionLetters = (text: string) =>
  text.split('\n').filter(line => /^\s*\[[0-9০-৯:]+\]/.test(line)).map(line => line.replace(/^\s*\[[0-9০-৯:]+\]/, ''))
    .join(' ').match(/[ঀ-৿]/g)?.length ?? 0;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

// Reads the captions of the given recordings from the folder's files, where a file of the same name ends in .txt
export const attachCaptions = async (recordings: File[], folderFiles: File[]) => {
  const texts = new Map(folderFiles.filter(f => /\.txt$/i.test(f.name) && f.size <= MAX_CAPTION_BYTES).map(f => [baseName(f.name), f]));
  for (const recording of recordings) {
    const caption = texts.get(baseName(recording.name));
    if (!caption) continue;
    try {
      rememberCaption(recording, await caption.text());
    } catch {
      // Unreadable captions only mean no comparison for this recording
    }
  }
};
