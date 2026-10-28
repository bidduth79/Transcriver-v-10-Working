import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const m = vi.hoisted(() => ({ supported: false, allow: vi.fn(), stop: vi.fn(), pause: vi.fn() }));
vi.mock('../../../services/watchFolder', () => ({ isFolderWatchSupported: () => m.supported }));
vi.mock('../../../hooks/useFolderWatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useFolderWatch')>()),
  allowWatchFolder: m.allow,
  stopWatchFolder: m.stop,
  pauseWatchFolder: m.pause,
}));

import { WatchFolderButton, WatchFolderStatus } from './WatchFolderControl';
import { useFolderWatchStore } from '../../../hooks/useFolderWatch';
import type { WatchFolderHandle } from '../../../services/watchFolder';

afterEach(cleanup);

describe('WatchFolderControl', () => {
  it('has no button where the browser cannot watch a folder', () => {
    m.supported = false;
    expect(render(<WatchFolderButton isDark={false} appLang="en" />).container.innerHTML).toBe('');
    m.supported = true;
    expect(render(<WatchFolderButton isDark={false} appLang="en" />).container.querySelector('button')).not.toBeNull();
  });

  it('shows the folder, asks for permission after a reload, and stops watching', () => {
    useFolderWatchStore.setState({ handle: { name: 'Audio' } as WatchFolderHandle, status: 'needsPermission' });
    const { getByText, getByTitle } = render(<WatchFolderStatus isDark={false} appLang="en" />);
    expect(getByText('Allow access to "Audio" again')).toBeTruthy();
    fireEvent.click(getByText('Allow'));
    expect(m.allow).toHaveBeenCalledWith('en');
    fireEvent.click(getByTitle('Stop watching this folder'));
    expect(m.stop).toHaveBeenCalled();
  });

  it('pauses a watched folder, and turns a paused one back on', () => {
    useFolderWatchStore.setState({ handle: { name: 'Audio' } as WatchFolderHandle, status: 'watching' });
    const watching = render(<WatchFolderStatus isDark={false} appLang="en" />);
    fireEvent.click(watching.getByTitle('Pause: new audio is not taken until it is turned on again'));
    expect(m.pause).toHaveBeenCalledWith('en');
    cleanup();

    useFolderWatchStore.setState({ status: 'paused' });
    const paused = render(<WatchFolderStatus isDark={false} appLang="en" />);
    expect(paused.getByText('Paused: Audio')).toBeTruthy();
    fireEvent.click(paused.getByTitle('Turn watching back on'));
    expect(m.allow).toHaveBeenCalledWith('en');
  });
});
