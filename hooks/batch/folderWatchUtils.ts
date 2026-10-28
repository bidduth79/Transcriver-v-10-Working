import { isSupportedMediaFile } from '../fileHandler/mediaDuration';
import { isSameRecording } from '../../utils/sameRecording';

interface PickOptions {
  // Transcripts in history, and files already handed to a batch in this session
  done: { name: string; size?: number | string }[];
  // File sizes seen on the previous look, by name
  lastSizes: Map<string, number>;
}

// Audio files of a watched folder that are ready to transcribe, oldest first.
// A file is taken only when its size is the same as on the last look, so a file still being copied waits.
// A recording already done, or saved twice under another date, is left out.
export const pickNewFiles = (files: File[], { done, lastSizes }: PickOptions) => {
  const sizes = new Map<string, number>();
  const audio = files.filter(isSupportedMediaFile).sort((a, b) => a.lastModified - b.lastModified);
  const ready: File[] = [];
  for (const file of audio) {
    sizes.set(file.name, file.size);
    if (lastSizes.get(file.name) !== file.size) continue;
    if ([...done, ...ready].some(other => isSameRecording(file, other))) continue;
    ready.push(file);
  }
  return { ready, sizes };
};
