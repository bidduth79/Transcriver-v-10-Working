import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAudioPlayback } from './useAudioPlayback';

const setup = () => {
  const { result } = renderHook(() => useAudioPlayback());
  const media = { currentTime: 0, play: vi.fn(() => Promise.reject(new Error('no source'))) };
  (result.current.audioRef as { current: unknown }).current = media;
  return { seek: result.current.handleSeek, media };
};

describe('useAudioPlayback.handleSeek', () => {
  it('seeks to [MM:SS], [H:MM:SS] and Bengali-digit timestamps', () => {
    const { seek, media } = setup();
    seek('[01:15]');
    expect(media.currentTime).toBe(75);
    seek('[1:02:05]');
    expect(media.currentTime).toBe(3725);
    seek('[০২:৩০]');
    expect(media.currentTime).toBe(150);
    expect(media.play).toHaveBeenCalledTimes(3);
  });

  it('ignores a timestamp it cannot read', () => {
    const { seek, media } = setup();
    seek('[ab:cd]');
    expect(media.currentTime).toBe(0);
    expect(media.play).not.toHaveBeenCalled();
  });
});
