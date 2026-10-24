import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useFileDrop } from './useFileDrop';

const dragEvent = (files: File[], folder = false) => ({
  preventDefault: vi.fn(),
  dataTransfer: {
    types: ['Files'],
    dropEffect: 'none',
    files,
    items: files.map(file => ({
      kind: 'file',
      webkitGetAsEntry: () => folder
        ? { isFile: false, isDirectory: true, createReader: () => { let done = false; return { readEntries: (ok: (e: unknown[]) => void) => { ok(done ? [] : [{ isFile: true, isDirectory: false, file: (cb: (f: File) => void) => cb(file) }]); done = true; } }; } }
        : { isFile: true, isDirectory: false, file: (cb: (f: File) => void) => cb(file) },
    })),
  },
}) as unknown as React.DragEvent;

const audio = (name: string) => new File(['x'], name, { type: 'audio/mpeg' });

describe('useFileDrop', () => {
  it('shows the drop state while files are over the card', () => {
    const { result } = renderHook(() => useFileDrop(vi.fn()));
    act(() => result.current.dropHandlers.onDragEnter(dragEvent([audio('a.mp3')])));
    expect(result.current.isDragging).toBe(true);
    act(() => result.current.dropHandlers.onDragLeave());
    expect(result.current.isDragging).toBe(false);
  });

  it('opens one audio file like a normal upload', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useFileDrop(onChange));
    await act(() => result.current.dropHandlers.onDrop(dragEvent([audio('a.mp3')])));
    expect(onChange).toHaveBeenCalledWith({ target: { files: [expect.any(File)], webkitdirectory: false } });
  });

  it('sends several files, a folder or a non-media file down the batch path', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useFileDrop(onChange));
    await act(() => result.current.dropHandlers.onDrop(dragEvent([audio('a.mp3'), audio('b.mp3')])));
    await act(() => result.current.dropHandlers.onDrop(dragEvent([audio('c.mp3')], true)));
    await act(() => result.current.dropHandlers.onDrop(dragEvent([new File(['x'], 'photo.png', { type: 'image/png' })])));
    expect(onChange.mock.calls.map(([e]) => [e.target.files.length, e.target.webkitdirectory])).toEqual([[2, true], [1, true], [1, true]]);
  });

  it('ignores drops while disabled', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useFileDrop(onChange, true));
    await act(() => result.current.dropHandlers.onDrop(dragEvent([audio('a.mp3')])));
    expect(onChange).not.toHaveBeenCalled();
  });
});
