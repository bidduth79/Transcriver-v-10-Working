import { describe, it, expect } from 'vitest';
import { clockToSeconds, timestampsIn } from './transcriptTimes';

describe('transcriptTimes', () => {
  it('reads a clock in Latin or Bengali digits, with or without hours', () => {
    expect(clockToSeconds('26:35')).toBe(1595);
    expect(clockToSeconds('1:02:03')).toBe(3723);
    expect(clockToSeconds('০৫:০০')).toBe(300);
  });

  it('finds every timestamp in order, in square or round brackets', () => {
    const text = '[00:10] **Speaker 1:** a\n(26:35) b [১:০২:০৩] c';
    expect(timestampsIn(text)).toEqual([
      { clock: '00:10', seconds: 10, index: 0 },
      { clock: '26:35', seconds: 1595, index: 25 },
      { clock: '১:০২:০৩', seconds: 3723, index: 35 },
    ]);
    expect(timestampsIn('no time here [abc]')).toEqual([]);
  });
});
