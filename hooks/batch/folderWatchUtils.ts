import { isSupportedMediaFile } from '../fileHandler/mediaDuration';

// The same file seen again; a file replaced under the same name gets a new key
export const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

interface PickOptions {
  // Names of files that already have a transcript in history
  doneNames: Set<string>;
  // Files already handed to a batch in this session (keys from fileKey)
  taken: Set<string>;
  // File sizes seen on the previous look, by name
  lastSizes: Map<string, number>;
}

// Audio files of a watched folder that are ready to transcribe, oldest first.
// A file is taken only when its size is the same as on the last look, so a file still being copied waits.
export const pickNewFiles = (files: File[], { doneNames, taken, lastSizes }: PickOptions) => {
  const sizes = new Map<string, number>();
  const ready: File[] = [];
  for (const file of files) {
    if (!isSupportedMediaFile(file)) continue;
    sizes.set(file.name, file.size);
    if (doneNames.has(file.name) || taken.has(fileKey(file))) continue;
    if (lastSizes.get(file.name) !== file.size) continue;
    ready.push(file);
  }
  ready.sort((a, b) => a.lastModified - b.lastModified);
  return { ready, sizes };
};
