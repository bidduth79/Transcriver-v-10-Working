import { describe, it, expect, vi } from 'vitest';

// Like the real parser: an Ogg file's length is only known when the end of the file is read
const parseBlob = vi.hoisted(() => vi.fn(async (_file: Blob, options?: { duration?: boolean }) => ({ format: { duration: options?.duration ? 4993.1 : undefined } })));
vi.mock('music-metadata', () => ({ parseBlob }));

import { readOpusDuration } from './mediaDuration';

const opus = (bytes: number) => {
  const file = new File(['x'], 'talk.opus', { type: 'audio/ogg' });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
};

describe('readOpusDuration', () => {
  it('reads the real length instead of guessing it from the size', async () => {
    // An 83-minute recording of 10 MB: guessing from the size would say 41:52
    expect(await readOpusDuration(opus(10046926), 'estimate')).toBe('83:13');
    expect(parseBlob).toHaveBeenCalledWith(expect.any(File), { duration: true });
  });

  it('falls back to the size-based guess, or "Unknown", when the file cannot be read', async () => {
    parseBlob.mockRejectedValueOnce(new Error('bad file'));
    expect(await readOpusDuration(opus(400000), 'estimate')).toBe('1:40');
    parseBlob.mockRejectedValueOnce(new Error('bad file'));
    expect(await readOpusDuration(opus(400000), 'unknown')).toBe('Unknown');
  });
});
