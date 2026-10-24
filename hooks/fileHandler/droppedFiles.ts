// Reads files from a drag & drop, walking into dropped folders (Chrome/Edge/Firefox entry API)

const readEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

const entryToFiles = async (entry: FileSystemEntry): Promise<File[]> => {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return [file];
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const files: File[] = [];
  // readEntries returns at most ~100 entries per call; keep reading until it is empty
  for (let batch = await readEntries(reader); batch.length > 0; batch = await readEntries(reader)) {
    for (const child of batch) files.push(...await entryToFiles(child));
  }
  return files;
};

export interface DroppedFiles {
  files: File[];
  hasFolder: boolean;
}

export const collectDroppedFiles = async (data: DataTransfer): Promise<DroppedFiles> => {
  // Entries must be taken synchronously, before the first await, or the browser clears them
  const entries = Array.from(data.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);

  if (entries.length === 0) return { files: Array.from(data.files ?? []), hasFolder: false };

  const nested = await Promise.all(entries.map(entry => entryToFiles(entry).catch(() => [])));
  const files = nested.flat().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { files, hasFolder: entries.some(entry => entry.isDirectory) };
};
