import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  folderModal: vi.fn(), noFilesModal: vi.fn(), alreadyModal: vi.fn(),
  parseBlob: vi.fn(), sniff: vi.fn(async () => ({ mimeType: 'video/mp4' })),
  media: [] as any[],
}));
vi.mock('./fileHandlerUtils', () => ({
  showFolderUploadModal: m.folderModal, showNoFilesFoundModal: m.noFilesModal, showFileAlreadyTranscribedModal: m.alreadyModal,
}));
vi.mock('music-metadata', () => ({ parseBlob: m.parseBlob }));
vi.mock('./transcription/transcriptionUtils', () => ({ detectAudioMimeType: m.sniff }));

import { renderHook } from '@testing-library/react';
import { useFileHandler } from './useFileHandler';

// Fake <audio>/<video> element: tests fire onloadedmetadata/onerror themselves
const fakeMedia = (tag: string) => { const el: any = { tag, src: '', load: vi.fn() }; m.media.push(el); return el; };
const file = (name: string, type: string, size = 1000) => { const f = new File(['x'], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
const flush = () => vi.advanceTimersByTimeAsync(0);

const setup = (over: any = {}) => {
  const p: any = {
    appLang: 'bn', addToast: vi.fn(), setFile: vi.fn(), setFileUrl: vi.fn(), fileUrl: 'blob:old',
    setActiveHistoryId: vi.fn(), setTranscriptMeta: vi.fn(), setTranscript: vi.fn(), setStatus: vi.fn(), setFileMeta: vi.fn(),
    processTranscription: vi.fn(), history: [], setBatchQueue: vi.fn(), setCurrentBatchIndex: vi.fn(), setIsBatchProcessing: vi.fn(),
    setHasBatchStarted: vi.fn(), setIsBatchPaused: vi.fn(), setBatchCountdown: vi.fn(), fileInputRef: { current: { value: 'x' } }, ...over,
  };
  const { handleFileChange } = renderHook(() => useFileHandler(p)).result.current;
  const pick = (files: File[], extra: any = {}, autoStart = false) => {
    const target: any = { files, value: 'picked', ...extra };
    handleFileChange({ target }, autoStart);
    return target;
  };
  return { p, pick };
};
const meta = (p: any) => p.setFileMeta.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  m.media = [];
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'audio' || tag === 'video' ? fakeMedia(tag) : realCreate(tag))) as any);
  vi.stubGlobal('Audio', function () { return fakeMedia('Audio'); });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:new'), revokeObjectURL: vi.fn() });
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('folder / multi-file upload', () => {
  it('queues supported files after confirmation and clears inputs on cancel', () => {
    const folder = { value: 'f' };
    vi.spyOn(document, 'getElementById').mockReturnValue(folder as any);
    const { p, pick } = setup();
    const target = pick([file('a.mp3', ''), file('b.txt', 'text/plain'), file('c', 'video/mp4'), file('d.OPUS', '')]);
    const [lang, count, onConfirm, onCancel] = m.folderModal.mock.calls[0];
    expect([lang, count]).toEqual(['bn', 3]);
    onConfirm();
    expect(p.setBatchQueue.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.mp3', 'c', 'd.OPUS']);
    expect([p.setCurrentBatchIndex, p.setIsBatchProcessing, p.setHasBatchStarted, p.setIsBatchPaused, p.setBatchCountdown].map(f => f.mock.calls[0][0])).toEqual([0, true, false, false, 0]);
    onCancel();
    expect([p.fileInputRef.current.value, folder.value, target.value]).toEqual(['', '', 'picked']);
  });

  it('shows "no files" when nothing is supported, and ignores empty picks', () => {
    const { pick, p } = setup();
    pick([file('a.txt', 'text/plain')], { webkitdirectory: true });
    expect(m.noFilesModal).toHaveBeenCalledWith('bn');
    pick([]);
    expect(p.setFile).not.toHaveBeenCalled();
  });
});

describe('single file', () => {
  it('rejects files over 70MB', () => {
    const { p, pick } = setup({ appLang: 'en' });
    pick([file('big.mp3', 'audio/mpeg', 70 * 1024 * 1024 + 1)]);
    expect(p.addToast).toHaveBeenCalledWith('File size cannot exceed 70MB', 'error');
    expect(p.fileInputRef.current.value).toBe('');
    expect(p.setFile).not.toHaveBeenCalled();
  });

  it('loads audio metadata, resets state and auto-starts', async () => {
    const { p, pick } = setup();
    const f = file('song.mp3', 'audio/mpeg', 2 * 1024 * 1024);
    const target = pick([f], {}, true);
    expect(target.value).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old');
    expect([p.setFileUrl, p.setActiveHistoryId, p.setTranscriptMeta, p.setTranscript, p.setStatus].map(fn => fn.mock.calls[0][0])).toEqual(['blob:new', null, null, '', 'idle']);
    const el = m.media[0];
    expect([el.tag, el.preload, el.src]).toEqual(['audio', 'metadata', 'blob:new']);
    el.duration = 125.6;
    el.onloadedmetadata();
    await flush();
    expect(meta(p)).toEqual({ name: 'song.mp3', size: '2.00 MB', duration: '2:05', type: 'audio/mpeg', date: '2026-10-22T10:00:00.000Z' });
    expect(p.processTranscription).toHaveBeenCalledWith(f, meta(p));
    expect([el.onloadedmetadata, el.src, el.load.mock.calls.length]).toEqual([null, '', 1]);
  });

  it('uses <video>, sniffs empty MIME types and falls back to Unknown', async () => {
    const { p, pick } = setup();
    pick([file('clip.MOV', '')]);
    expect(m.media[0].tag).toBe('video');
    m.media[0].duration = Infinity;
    m.media[0].onloadedmetadata();
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p)).toMatchObject({ duration: 'Unknown', type: 'video/mp4' });
    expect(p.processTranscription).not.toHaveBeenCalled();

    pick([file('x.wav', 'audio/wav')]);
    m.media[1].onerror();
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p).duration).toBe('Unknown');

    pick([file('y.wav', 'audio/wav')]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(meta(p).duration).toBe('Unknown');
    m.media[2].onloadedmetadata?.();
    expect(p.setFileMeta).toHaveBeenCalledTimes(3);
  });

  it('reads Opus duration with music-metadata, estimating when missing or failing', async () => {
    const { p, pick } = setup();
    m.parseBlob.mockResolvedValueOnce({ format: { duration: 61.9 } });
    pick([file('v.opus', '', 4000)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p).duration).toBe('1:01');
    m.parseBlob.mockResolvedValueOnce({ format: {} });
    pick([file('w.ogg', 'audio/ogg', 400000)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p).duration).toBe('1:40');
    m.parseBlob.mockRejectedValueOnce(new Error('bad'));
    pick([file('z', 'audio/opus', 100)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p)).toMatchObject({ duration: '0:10', type: 'audio/opus' });
    expect(m.media).toHaveLength(0);
  });
});

describe('file already in history', () => {
  const existing = { id: 'h1', fileName: 'old.mp3', duration: '3:00', transcript: 'TEXT', channelName: 'Ch', publishedDate: '2026-01-01' };

  it('re-transcribes on confirm', () => {
    const { p, pick } = setup({ history: [existing] });
    pick([file('old.mp3', 'audio/mpeg')]);
    m.alreadyModal.mock.calls[0][1]();
    m.media[0].duration = 10;
    m.media[0].onloadedmetadata();
    return flush().then(() => expect(p.processTranscription).toHaveBeenCalled());
  });

  it('loads the saved transcript and probes duration with Audio()', async () => {
    const { p, pick } = setup({ history: [existing], appLang: 'en' });
    pick([file('old.mp3', 'audio/mpeg')]);
    expect(m.alreadyModal.mock.calls[0][0]).toBe('en');
    m.alreadyModal.mock.calls[0][2]();
    expect(p.setTranscript).toHaveBeenCalledWith('TEXT');
    expect(p.setStatus).toHaveBeenCalledWith('completed');
    expect(p.setTranscriptMeta).toHaveBeenCalledWith({ name: 'old.mp3', duration: '3:00', channelName: 'Ch', date: '2026-01-01' });
    expect(p.setActiveHistoryId).toHaveBeenCalledWith('h1');
    expect(p.addToast).toHaveBeenCalledWith('History loaded', 'info');
    const a = m.media[0];
    expect([a.tag, a.src]).toEqual(['Audio', 'blob:new']);
    a.duration = 30;
    a.onloadedmetadata();
    expect(meta(p)).toEqual({ name: 'old.mp3', size: '0.00 MB', duration: '0:30', type: 'audio/mpeg', date: '2026-10-22T10:00:00.000Z' });
  });

  it('falls back to the saved duration on error/timeout, and Unknown for unreadable Opus', async () => {
    const { p, pick } = setup({ history: [existing, { ...existing, id: 'h2', fileName: 'n.opus', duration: '' }] });
    pick([file('old.mp3', 'audio/mpeg')]);
    m.alreadyModal.mock.calls[0][2]();
    m.media[0].onerror();
    expect(meta(p).duration).toBe('3:00');
    pick([file('old.mp3', 'audio/mpeg')]);
    m.alreadyModal.mock.calls[1][2]();
    await vi.advanceTimersByTimeAsync(3000);
    expect(meta(p).duration).toBe('3:00');
    m.parseBlob.mockRejectedValueOnce(new Error('bad'));
    pick([file('n.opus', '')]);
    m.alreadyModal.mock.calls[2][2]();
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p)).toMatchObject({ duration: 'Unknown', type: '' });
    m.parseBlob.mockResolvedValueOnce({ format: {} });
    pick([file('n.opus', '', 8000)]);
    m.alreadyModal.mock.calls[3][2]();
    await vi.advanceTimersByTimeAsync(0);
    expect(meta(p).duration).toBe('0:10');
  });
});
