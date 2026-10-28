import { describe, it, expect } from 'vitest';
import { lastTimestampSeconds, appendContinuation } from './transcriptContinuation';

describe('transcriptContinuation', () => {
  it('finds the latest time, in any timestamp form', () => {
    expect(lastTimestampSeconds('[00:10] a\n[26:35] b')).toBe(1595);
    expect(lastTimestampSeconds('[1:02:03] a\n[০৫:০০] b')).toBe(3723);
    expect(lastTimestampSeconds('no time')).toBeNull();
  });

  it('adds only what comes after the time already written', () => {
    const rest = 'Here is the rest:\n[26:30] repeated\nmore of it\n[28:20] after\nsplit part';
    expect(appendContinuation('[26:35] break\n', rest, 1595)).toBe('[26:35] break\n[28:20] after\nsplit part');
    expect(appendContinuation('[26:35] break', '[26:35] break', 1595)).toBe('[26:35] break');
  });
});
