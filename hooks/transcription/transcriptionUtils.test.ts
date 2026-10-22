import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  blobToBase64, removeRepetitiveBlocks, isFormatNativelySupportedByGemini,
  calculateEstimatedSeconds, parseDurationToSeconds, detectAudioMimeType, convertAudioToWav,
} from './transcriptionUtils';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const blobOf = (data: Uint8Array, type = '') => new Blob([data], { type });

// Minimal AudioBuffer stand-in for WAV encoding tests
const fakeBuffer = (channels: Float32Array[], sampleRate: number, duration = 1) => ({
  numberOfChannels: channels.length,
  length: channels[0].length,
  sampleRate,
  duration,
  getChannelData: (c: number) => channels[c],
});
const checksum = (buf: ArrayBuffer) => new Uint8Array(buf).reduce((a, b, i) => (a + b * (i + 1)) % 1000000007, 0);

afterEach(() => vi.unstubAllGlobals());

describe('small helpers', () => {
  it('blobToBase64 strips the data URL prefix', async () => {
    expect(await blobToBase64(new Blob(['hello'], { type: 'text/plain' }))).toBe('aGVsbG8=');
  });

  it('isFormatNativelySupportedByGemini', () => {
    expect(isFormatNativelySupportedByGemini('')).toBe(false);
    expect(isFormatNativelySupportedByGemini('AUDIO/MPEG')).toBe(true);
    expect(isFormatNativelySupportedByGemini('audio/ogg; codecs=opus')).toBe(true);
    expect(isFormatNativelySupportedByGemini('video/mp4')).toBe(false);
  });

  it('calculateEstimatedSeconds and parseDurationToSeconds', () => {
    expect(calculateEstimatedSeconds(0, 0)).toBe(10);
    expect(calculateEstimatedSeconds(0, 20 * 1024 * 1024)).toBe(60);
    expect(calculateEstimatedSeconds(10, 0)).toBe(8);
    expect(calculateEstimatedSeconds(600, 0)).toBe(42);
    expect(parseDurationToSeconds(undefined)).toBe(0);
    expect(parseDurationToSeconds('02:30')).toBe(150);
    expect(parseDurationToSeconds('1:02:03')).toBe(3723);
    expect(parseDurationToSeconds('42')).toBe(0);
  });
});

describe('removeRepetitiveBlocks', () => {
  const para = (ts: string, text: string) => `[${ts}] **Speaker 1:** ${text}`;
  const cases: Record<string, string> = {
    short: 'ছোট লেখা।',
    repeatedParagraphs: Array.from({ length: 5 }, (_, i) => para(`00:0${i}`, 'আজকের আলোচনার মূল বিষয় হলো সীমান্ত নিরাপত্তা এবং চোরাচালান প্রতিরোধ')).join('\n'),
    banglaDigits: [para('০০:০১', 'একই বাক্য বারবার বলা হচ্ছে এখানে দেখুন'), para('০০:০২', 'একই বাক্য বারবার বলা হচ্ছে এখানে দেখুন'), para('০০:০৩', 'একই বাক্য বারবার বলা হচ্ছে এখানে দেখুন'), para('০০:০৪', 'নতুন কথা এখানে শুরু হলো এবং শেষ হলো')].join('\n'),
    repeatedSentences: 'এটি একটি দীর্ঘ পরীক্ষামূলক বাক্য। এটি একটি দীর্ঘ পরীক্ষামূলক বাক্য। ভিন্ন একটি বাক্য এখানে আছে? এটি একটি দীর্ঘ পরীক্ষামূলক বাক্য! শেষ বাক্যটি আলাদা এবং অনন্য।',
    runOnClauses: Array.from({ length: 12 }, () => 'আমরা সবাই মিলে একসাথে কাজ করব').join(', ') + ' এবং শেষ।',
    // 25-char paragraph repeated far apart: only the paragraph-level rule (max 2 copies) removes the 3rd
    farApartParagraphs: Array.from({ length: 3 }, (_, r) => ['এইবাক্যটিপঁচিশঅক্ষরেরপরীক্ষা', ...Array.from({ length: 16 }, (_, i) => `ভিন্ন অনুচ্ছেদ নম্বর ${r}-${i} এখানে লেখা`)].join('\n')).join('\n'),
    englishMixed: 'Hello world this is a test sentence that repeats. Hello world this is a test sentence that repeats. Then something different happens here!\n\nNew paragraph text.',
  };
  it.each(Object.keys(cases))('cleans %s', (name) => {
    expect(removeRepetitiveBlocks(cases[name])).toMatchSnapshot();
  });

  it('keeps speaker lines separate when a paragraph ends with punctuation', () => {
    const text = [
      para('00:00', 'আজ আমরা সীমান্ত পরিস্থিতি নিয়ে বিস্তারিত আলোচনা করব।'),
      para('00:10', 'আপনি কি এ বিষয়ে আমাদের কিছু বলবেন?'),
      para('00:20', 'অবশ্যই, পরিস্থিতি এখন অনেকটা স্বাভাবিক!'),
    ].join('\n\n');
    expect(removeRepetitiveBlocks(text)).toBe(text);
  });
});

describe('detectAudioMimeType', () => {
  it.each([
    ['ogg', bytes(0x4f, 0x67, 0x67, 0x53), 'a.bin', { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: false }],
    ['id3', bytes(0x49, 0x44, 0x33), 'WhatsApp Audio.bin', { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: true }],
    ['mpeg sync', bytes(0xff, 0xfb), 'x', { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: false }],
    ['wav', bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45), 'x', { mimeType: 'audio/wav', isOggOpus: false, isWhatsApp: false }],
    ['m4a', bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70), 'voice.m4a', { mimeType: 'audio/mp4', isOggOpus: false, isWhatsApp: false }],
    ['mp4 video', bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70), 'clip.mp4', { mimeType: 'video/mp4', isOggOpus: false, isWhatsApp: false }],
    ['webm video', bytes(0x1a, 0x45, 0xdf, 0xa3), 'clip.webm', { mimeType: 'video/webm', isOggOpus: false, isWhatsApp: false }],
    ['webm audio', bytes(0x1a, 0x45, 0xdf, 0xa3), 'audio-rec.webm', { mimeType: 'audio/webm', isOggOpus: false, isWhatsApp: false }],
    ['flac', bytes(0x66, 0x4c, 0x61, 0x43), 'x', { mimeType: 'audio/flac', isOggOpus: false, isWhatsApp: false }],
    ['ext opus', bytes(1, 2, 3), 'note.opus', { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: false }],
    ['ext mov', bytes(1, 2, 3), 'a.MOV', { mimeType: 'video/quicktime', isOggOpus: false, isWhatsApp: false }],
    ['ext webm video', bytes(1, 2, 3), 'my-video.webm', { mimeType: 'video/webm', isOggOpus: false, isWhatsApp: false }],
    ['ptt no ext', bytes(1, 2, 3), 'PTT-20240101', { mimeType: 'audio/ogg', isOggOpus: true, isWhatsApp: true }],
    ['default', bytes(1, 2, 3), 'unknown', { mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: false }],
  ])('%s', async (_n, data, name, expected) => {
    expect(await detectAudioMimeType(blobOf(data as Uint8Array), name as string)).toEqual(expected);
  });

  it('uses blob type when nothing else matches', async () => {
    expect(await detectAudioMimeType(blobOf(bytes(1, 2), 'audio/x-opus+ogg'), 'voice')).toEqual({ mimeType: 'audio/x-opus+ogg', isOggOpus: true, isWhatsApp: true });
    expect(await detectAudioMimeType(blobOf(bytes(0xff, 0xf1)), 'x')).toEqual({ mimeType: 'audio/mp3', isOggOpus: false, isWhatsApp: false });
  });
});

describe('convertAudioToWav', () => {
  it('skips files over 1MB and browsers without AudioContext', async () => {
    expect(await convertAudioToWav(new Blob([new Uint8Array(1024 * 1024 + 1)]))).toBeNull();
    vi.stubGlobal('AudioContext', undefined);
    expect(await convertAudioToWav(new Blob(['x']))).toBeNull();
  });

  const stubContext = (buffer: any) => {
    const close = vi.fn(async () => {});
    vi.stubGlobal('AudioContext', class {
      state = 'suspended';
      resume = vi.fn(async () => { this.state = 'running'; });
      decodeAudioData = vi.fn(async () => buffer);
      close = close;
    });
    return close;
  };

  it('applies proportional gain below the 10x cap', async () => {
    const mid = Float32Array.from({ length: 1600 }, (_, i) => 0.3 * Math.sin(i / 3));
    stubContext(fakeBuffer([mid], 16000, 0.1));
    const res = await convertAudioToWav(new Blob(['x']));
    expect(checksum(await res!.wavBlob.arrayBuffer())).toMatchSnapshot();
  });

  it('encodes quiet stereo 48k audio to boosted 16k mono WAV', async () => {
    const n = 4800;
    const left = Float32Array.from({ length: n }, (_, i) => 0.1 * Math.sin(i / 7));
    const right = Float32Array.from({ length: n }, (_, i) => 0.05 * Math.cos(i / 5));
    const close = stubContext(fakeBuffer([left, right], 48000, 0.1));
    const res = await convertAudioToWav(new Blob(['x']));
    expect(close).toHaveBeenCalled();
    const buf = await res!.wavBlob.arrayBuffer();
    const view = new DataView(buf);
    expect(res!.wavBlob.type).toBe('audio/wav');
    expect({ size: buf.byteLength, rate: view.getUint32(24, true), channels: view.getUint16(22, true), sum: checksum(buf), rms: res!.rms.toFixed(6), duration: res!.duration }).toMatchSnapshot();
  });

  it('keeps loud mono audio at same rate and rejects long audio', async () => {
    const loud = Float32Array.from({ length: 1600 }, (_, i) => (i % 2 ? 0.9 : -0.95));
    stubContext(fakeBuffer([loud], 16000, 0.1));
    const res = await convertAudioToWav(new Blob(['x']));
    expect(checksum(await res!.wavBlob.arrayBuffer())).toMatchSnapshot();
    stubContext(fakeBuffer([loud], 16000, 181));
    expect(await convertAudioToWav(new Blob(['x']))).toBeNull();
  });
});
