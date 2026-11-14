import { describe, it, expect, beforeEach } from 'vitest';
import { splitLimits, isSplittingOn, setSplittingOn } from './splitPolicy';

beforeEach(() => localStorage.clear());

describe('splitLimits', () => {
  it('is on unless turned off', () => {
    expect(isSplittingOn()).toBe(true);
    setSplittingOn(false);
    expect(isSplittingOn()).toBe(false);
    setSplittingOn(true);
    expect(isSplittingOn()).toBe(true);
  });

  it('splits only where parts did better: Lite from 20 minutes, transcribe past its limit, WAV/MP3 from 30', () => {
    expect(splitLimits('gemini-3.5-flash-lite', 'pro')).toEqual({ ogg: 1200, other: 1200 });
    expect(splitLimits('gemini-3.1-flash-lite', 'normal')).toEqual({ ogg: 1200, other: 1200 });
    expect(splitLimits('gemini-3.5-transcribe', 'pro')).toEqual({ ogg: 1800, other: 1800 });
    expect(splitLimits('gemini-3.5-transcribe', 'normal')).toEqual({ ogg: 3600, other: 3600 });
    // Flash and Hydrogen: Opus whole
    expect(splitLimits('gemini-3.5-flash', 'pro')).toEqual({ ogg: null, other: 1800 });
    expect(splitLimits('gemini-4-hydrogen', 'pro')).toEqual({ ogg: null, other: 1800 });
  });

  it('sends everything whole when the switch is off', () => {
    setSplittingOn(false);
    for (const model of ['gemini-3.5-flash-lite', 'gemini-3.5-transcribe', 'gemini-3.5-flash']) {
      expect(splitLimits(model, 'pro')).toEqual({ ogg: null, other: null });
    }
  });
});
