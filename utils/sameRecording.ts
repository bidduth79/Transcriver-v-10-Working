// "Title_2026-10-27.opus" and "Title_2026-10-28.opus" of about the same size: one recording saved on two days

interface Recording {
  name: string;
  // Bytes, or a history label such as "9.59 MB"; unknown sizes never match by title alone
  size?: number | string;
}

const DATE_SUFFIX = /_\d{4}-\d{2}-\d{2}$/;

export const recordingTitle = (name: string) => name.normalize('NFC').replace(/\.[^.]+$/, '').replace(DATE_SUFFIX, '').trim();

const bytesOf = (size: Recording['size']) => {
  if (typeof size === 'number') return size;
  const mb = parseFloat(size ?? '');
  return /MB$/i.test(size ?? '') && mb > 0 ? mb * 1024 * 1024 : undefined;
};

export const isSameRecording = (a: Recording, b: Recording) => {
  if (a.name === b.name) return true;
  if (recordingTitle(a.name) !== recordingTitle(b.name)) return false;
  const [sizeA, sizeB] = [bytesOf(a.size), bytesOf(b.size)];
  return sizeA !== undefined && sizeB !== undefined && Math.abs(sizeA - sizeB) <= Math.max(sizeA, sizeB) * 0.01;
};

// Already in history: the same name (and size, when history knows it), or the same recording under another date
export const isAlreadyTranscribed = (file: { name: string; size: number }, history: { fileName: string; size?: string }[]) => {
  const sizeLabel = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  return history.some(h => {
    if (h.fileName !== file.name) return isSameRecording(file, { name: h.fileName, size: h.size });
    return h.size ? h.size === sizeLabel : true;
  });
};
