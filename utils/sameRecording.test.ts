import { describe, it, expect } from 'vitest';
import { isSameRecording, recordingTitle, isAlreadyTranscribed } from './sameRecording';

describe('isSameRecording', () => {
  it('matches one recording saved on two days at about the same size', () => {
    expect(recordingTitle('Talk show_2026-10-27.opus')).toBe('Talk show');
    expect(isSameRecording({ name: 'Talk show_2026-10-27.opus', size: 10046926 }, { name: 'Talk show_2026-10-28.opus', size: 10056615 })).toBe(true);
    expect(isSameRecording({ name: 'Talk show_2026-10-28.opus', size: 10056615 }, { name: 'Talk show_2026-10-27.opus', size: '9.58 MB' })).toBe(true);
  });

  it('keeps different recordings apart', () => {
    expect(isSameRecording({ name: 'Talk show_2026-10-27.opus', size: 10046926 }, { name: 'Talk show_2026-10-28.opus', size: 5000000 })).toBe(false);
    expect(isSameRecording({ name: 'Talk show_2026-10-27.opus', size: 100 }, { name: 'Talk show_2026-10-28.opus' })).toBe(false);
    expect(isSameRecording({ name: 'News_2026-10-27.opus', size: 100 }, { name: 'Sports_2026-10-27.opus', size: 100 })).toBe(false);
  });

  it('a file of the same name is the same, whatever its size', () => {
    expect(isSameRecording({ name: 'a.opus', size: 1 }, { name: 'a.opus', size: 999 })).toBe(true);
  });
});

describe('isAlreadyTranscribed', () => {
  const history = [{ fileName: 'a.mp3', size: '2.00 MB' }, { fileName: 'b.mp3' }, { fileName: 'Talk_2026-10-27.opus', size: '9.58 MB' }];
  it('finds a file by name and size, by name alone when history has no size, or under another date', () => {
    expect(isAlreadyTranscribed({ name: 'a.mp3', size: 2 * 1024 * 1024 }, history)).toBe(true);
    expect(isAlreadyTranscribed({ name: 'a.mp3', size: 3 * 1024 * 1024 }, history)).toBe(false);
    expect(isAlreadyTranscribed({ name: 'b.mp3', size: 5 }, history)).toBe(true);
    expect(isAlreadyTranscribed({ name: 'Talk_2026-10-28.opus', size: 10056615 }, history)).toBe(true);
    expect(isAlreadyTranscribed({ name: 'c.mp3', size: 5 }, history)).toBe(false);
  });
});
