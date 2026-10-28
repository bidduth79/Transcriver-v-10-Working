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
