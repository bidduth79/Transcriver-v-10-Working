import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('./hooks/useWaveform', () => ({ useWaveform: () => null }));

import { FileInfoSection } from './FileInfoSection';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const setup = (name: string, type: string) => render(
  <FileInfoSection
    fileUrl="blob:1" isRecording={false} t={{} as never} resetAll={vi.fn()} cardBg="" cardBorder="" isDark={false} subTextColor=""
    fileMeta={{ name, type, size: '4.98 MB', duration: '42:36' } as never} activeColors={{} as never} audioRef={{ current: null }}
    handleTimeUpdate={vi.fn()} skipTime={vi.fn()} playbackRate={1} changePlaybackRate={vi.fn()} processTranscription={vi.fn()}
    setIsSidebarOpen={vi.fn()} status="idle"
  />,
);

describe('FileInfoSection player', () => {
  it('plays an Opus file where the browser can (Chrome, Edge, Firefox)', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const { container } = setup('talk show.opus', 'audio/ogg');
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('blob:1');
    expect(container.textContent).not.toContain('Preview not supported');
  });

  it('shows a note instead of a broken player where the browser cannot play Opus', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    const { container } = setup('talk show.opus', 'audio/ogg');
    expect(container.querySelector('audio')).toBeNull();
    expect(container.textContent).toContain('Preview not supported for Opus files in browser');
  });

  it('plays an MP3 as before', () => {
    expect(setup('clip.mp3', 'audio/mpeg').container.querySelector('audio')).not.toBeNull();
  });
});
