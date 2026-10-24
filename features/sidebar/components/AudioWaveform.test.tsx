import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AudioWaveform } from './AudioWaveform';

describe('AudioWaveform', () => {
  it('jumps the player to the clicked point and redraws on playback', () => {
    const media = document.createElement('audio');
    Object.defineProperty(media, 'duration', { value: 200 });
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D);
    const { container } = render(<AudioWaveform peaks={[0.2, 1, 0.5, 0]} audioRef={{ current: media }} isDark={false} title="hint" />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.title).toBe('hint');
    expect(fillRect).toHaveBeenCalledTimes(4);

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect);
    fireEvent.click(canvas, { clientX: 200 });
    expect(media.currentTime).toBe(50);
    media.dispatchEvent(new Event('timeupdate'));
    expect(fillRect).toHaveBeenCalledTimes(8);
  });
});
