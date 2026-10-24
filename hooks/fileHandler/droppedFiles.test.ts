import { describe, it, expect } from 'vitest';
import { collectDroppedFiles } from './droppedFiles';

const fileEntry = (name: string) => ({
  isFile: true, isDirectory: false, name,
  file: (ok: (f: File) => void) => ok(new File(['x'], name, { type: 'audio/mpeg' })),
});

// Hands out children in pages, like Chrome does for big folders
const dirEntry = (name: string, children: unknown[], pageSize = 2) => ({
  isFile: false, isDirectory: true, name,
  createReader: () => {
    let at = 0;
    return { readEntries: (ok: (e: unknown[]) => void) => { ok(children.slice(at, at + pageSize)); at += pageSize; } };
  },
});

const transfer = (entries: unknown[], files: File[] = []) => ({
  items: entries.map(entry => ({ kind: 'file', webkitGetAsEntry: () => entry })),
  files,
}) as unknown as DataTransfer;

describe('collectDroppedFiles', () => {
  it('walks nested folders, reads every page and sorts by name', async () => {
    const tree = dirEntry('calls', [fileEntry('b10.mp3'), fileEntry('b2.mp3'), dirEntry('inner', [fileEntry('a1.mp3')]), fileEntry('c.mp3')]);
    const { files, hasFolder } = await collectDroppedFiles(transfer([tree]));
    expect(files.map(f => f.name)).toEqual(['a1.mp3', 'b2.mp3', 'b10.mp3', 'c.mp3']);
    expect(hasFolder).toBe(true);
  });

  it('returns loose files without marking a folder', async () => {
    const { files, hasFolder } = await collectDroppedFiles(transfer([fileEntry('one.mp3')]));
    expect(files.map(f => f.name)).toEqual(['one.mp3']);
    expect(hasFolder).toBe(false);
  });

  it('falls back to the plain file list when entries are not available', async () => {
    const plain = new File(['x'], 'plain.wav');
    const { files } = await collectDroppedFiles({ items: [], files: [plain] } as unknown as DataTransfer);
    expect(files).toEqual([plain]);
  });
});
