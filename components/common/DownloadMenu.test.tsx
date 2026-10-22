import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: m.toast }));

import { DownloadMenu } from './DownloadMenu';

const transcript = [
  '[00:05] **Speaker 1:** হ্যালো, সীমান্ত এলাকায় আজ মাদক উদ্ধার হয়েছে।',
  '[০১:০৭] **বক্তা ২:** জি, Border Guard দল কাজ করছে (00:59) এবং [1:02:03] পরে আবার।',
  '[00:58] **Speaker 1:** শেষ কথা।',
].join(' ');

// Matches Bengali text regardless of Unicode composition (source and test may encode "য়" differently)
const bn = (expected: string) => ({ asymmetricMatch: (a: any) => typeof a === 'string' && a.normalize('NFC') === expected.normalize('NFC'), toString: () => expected });

let blobs: { blob: Blob; name: string }[] = [];
const toText = async (b: Blob) => new TextDecoder().decode(await b.arrayBuffer());

const setup = (over: any = {}) => {
  const addToast = vi.fn();
  const props = {
    transcript, fileName: 'news.clip.mp3', activeColors: {}, t: { download: 'DOWNLOAD' },
    searchTerm: '', sensitiveMatches: ['মাদক', 'border'], addToast, ...over,
  };
  const utils = render(<DownloadMenu {...props} />);
  const open = () => fireEvent.click(utils.container.querySelector('button')!);
  const pick = (label: string) => fireEvent.click(utils.getByText(label).closest('button')!);
  return { ...utils, addToast, open, pick };
};

beforeEach(() => {
  vi.clearAllMocks();
  blobs = [];
  vi.stubGlobal('URL', { ...URL, createObjectURL: (b: Blob) => { blobs.push({ blob: b, name: '' }); return 'blob:x'; }, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { blobs[blobs.length - 1].name = this.download; });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T10:00:00'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('DownloadMenu markup', () => {
  it('renders closed and open states', () => {
    const { container, open } = setup();
    expect(container.innerHTML).toMatchSnapshot('closed');
    open();
    expect(container.innerHTML).toMatchSnapshot('open with keyword toggle');
  });

  it('renders custom trigger without keyword toggle', () => {
    const { container, getByText } = setup({ customTrigger: <span>MY TRIGGER</span>, sensitiveMatches: [] });
    fireEvent.click(getByText('MY TRIGGER'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('DownloadMenu exports', () => {
  it('exports TXT with timestamps on new lines', async () => {
    const { open, pick, addToast, container } = setup();
    open(); pick('Notepad');
    expect(blobs[0].name).toBe('news_transcript.txt');
    expect(blobs[0].blob.type).toBe('text/plain;charset=utf-8');
    expect(await toText(blobs[0].blob)).toMatchSnapshot();
    expect(addToast).toHaveBeenCalledWith(bn('TXT ফাইল ডাউনলোড শুরু হয়েছে'), 'success');
    expect(container.textContent).not.toContain('Notepad');
  });

  it('exports Word with and without keyword highlight', async () => {
    const a = setup();
    a.open(); a.pick('Word Document');
    expect(blobs[0].name).toBe('news_transcript.doc');
    expect(blobs[0].blob.type).toBe('application/msword');
    expect(await toText(blobs[0].blob)).toMatchSnapshot('highlighted');
    a.open();
    fireEvent.click(a.container.querySelector('input[type="checkbox"]')!);
    a.pick('Word Document');
    expect(await toText(blobs[1].blob)).toMatchSnapshot('plain');
  });

  it('exports SRT with Bengali digits converted', async () => {
    const { open, pick } = setup({ fileName: undefined });
    open(); pick('Subtitle SRT');
    expect(blobs[0].name).toBe('transcript_transcript.srt');
    expect(await toText(blobs[0].blob)).toMatchSnapshot();
  });

  it('writes a print window for PDF with search and keyword highlights', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T10:00:00'));
    let html = '';
    const win: any = { closed: false, document: { write: (h: string) => { html += h; }, close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win);
    const { open, pick, container } = setup({ searchTerm: 'কথা' });
    open(); pick('PDF Document');
    expect(container.textContent).not.toContain('PDF Document');
    expect(m.toast.info).toHaveBeenCalledWith(bn('PDF প্রস্তুত করা হচ্ছে...'), { id: 'pdf-export-toast', duration: 1500 });
    expect(html).toMatchSnapshot();
    expect(win.print).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(win.print).toHaveBeenCalled();
    expect(m.toast.success).toHaveBeenCalledWith(bn('PDF প্রস্তুত হয়েছে!'), { id: 'pdf-export-toast', duration: 1200 });
    win.onafterprint();
    expect(win.close).toHaveBeenCalled();
  });

  it('waits for fonts (max 300ms) before printing', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    const win: any = { closed: false, document: { write: vi.fn(), close: vi.fn(), fonts: { ready: new Promise(() => {}) } }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(win);
    const { open, pick } = setup();
    open(); pick('PDF Document');
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(win.print).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(win.print).toHaveBeenCalled();
  });

  it('reports blocked popups', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { open, pick, addToast } = setup();
    open(); pick('PDF Document');
    expect(addToast).toHaveBeenCalledWith(bn('পপ-আপ ব্লক করা আছে। দয়া করে পপ-আপ অ্যালাউ করুন।'), 'error');
  });

  it('reports download errors and closes on outside click', () => {
    vi.stubGlobal('URL', { createObjectURL: () => { throw new Error('no blob'); } });
    const { open, pick, addToast, container } = setup();
    open(); pick('Notepad');
    expect(addToast).toHaveBeenCalledWith(bn('ডাউনলোড ত্রুটি: no blob'), 'error');
    fireEvent.mouseDown(document.body);
    expect(container.textContent).not.toContain('Notepad');
  });
});
