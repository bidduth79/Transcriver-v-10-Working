import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { YouTubeInput } from './YouTubeInput';
import type { ActiveColors } from '../../hooks/useAppTheme';

const setup = (appLang: 'bn' | 'en' = 'en') => {
  const onSuccess = vi.fn();
  const utils = render(<YouTubeInput onSuccess={onSuccess} isDark appLang={appLang} activeColors={{} as ActiveColors} />);
  const submit = async (url: string) => {
    fireEvent.change(utils.getByPlaceholderText(/YouTube/), { target: { value: url } });
    await act(async () => { fireEvent.submit(utils.container.querySelector('form')!); });
  };
  return { ...utils, onSuccess, submit };
};

beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('YouTubeInput', () => {
  it('calls the local server set in Settings and passes the audio on', async () => {
    localStorage.setItem('feature_xampp_server_enabled', 'true');
    localStorage.setItem('api_base_url', 'http://192.168.0.5/licell_api');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ base64: 'AAAA', format: 'mp3', filename: 'talk.mp3' }) })
      .mockResolvedValueOnce({ blob: async () => new Blob(['x']) });
    vi.stubGlobal('fetch', fetchMock);
    const { submit, onSuccess, container } = setup();
    expect(container.textContent).not.toContain('needs your local server');
    await submit('https://youtu.be/abc');
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.0.5/licell_api/youtube.php');
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Blob), 'talk.mp3', 'transcribe');
  });

  it('explains the local server when it is off or cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { submit, container } = setup();
    expect(container.textContent).toContain('needs your local server (XAMPP + yt-dlp)');
    await submit('https://youtu.be/abc');
    expect(container.textContent).toContain('Could not reach the local server');
  });

  it('shows the server error message as it is', async () => {
    localStorage.setItem('feature_xampp_server_enabled', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ error: 'yt-dlp not found' }) }));
    const { submit, container } = setup();
    await submit('https://youtu.be/abc');
    expect(container.textContent).toContain('yt-dlp not found');
  });
});
