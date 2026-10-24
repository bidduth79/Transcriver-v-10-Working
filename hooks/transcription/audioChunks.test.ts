import { describe, it, expect } from 'vitest';
import { planAudioChunks, CHUNK_SECONDS } from './audioChunks';
import { shiftTimestamps, formatClock } from './timestampShift';

// 16-bit mono PCM at a tiny sample rate keeps an hour of audio under 1 MB
const RATE = 100;
const makeWav = (seconds: number, quietAt?: number) => {
  const samples = new Int16Array(seconds * RATE).map((_, i) => (i % 2 ? 8000 : -8000));
  if (quietAt !== undefined) samples.fill(0, quietAt * RATE, (quietAt + 1) * RATE);
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); header.setUint32(4, 36 + samples.byteLength, true); text(8, 'WAVE');
  text(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
  header.setUint32(24, RATE, true); header.setUint32(28, RATE * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
  text(36, 'data'); header.setUint32(40, samples.byteLength, true);
  return new Blob([header.buffer, samples.buffer], { type: 'audio/wav' });
};

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const readHeader = async (blob: Blob) => {
  const b = await bytesOf(blob);
  const view = new DataView(b.buffer);
  return { riff: String.fromCharCode(...b.subarray(0, 4)), rate: view.getUint32(24, true), dataSize: view.getUint32(40, true), size: b.length };
};

describe('planAudioChunks', () => {
  it('leaves recordings under 30 minutes and other formats alone', async () => {
    expect(await planAudioChunks(makeWav(29 * 60), 'audio/wav', 0)).toBeNull();
    expect(await planAudioChunks(new Blob([new Uint8Array(5000)], { type: 'audio/mp4' }), 'audio/mp4', 7200)).toBeNull();
  });

  it('cuts a long WAV into valid WAV parts, at the quietest moment near each cut', async () => {
    // 61 minutes -> 5 parts of about 12.2 minutes; the first cut aims at 732 s, silence sits at 736-737 s
    const parts = (await planAudioChunks(makeWav(61 * 60, 736), 'audio/wav', 0))!;
    expect(parts).toHaveLength(Math.ceil((61 * 60) / CHUNK_SECONDS));
    expect(parts[0].startSeconds).toBe(0);
    expect(parts[1].startSeconds).toBeGreaterThanOrEqual(736);
    expect(parts[1].startSeconds).toBeLessThanOrEqual(737);
    let total = 0;
    for (const part of parts) {
      const header = await readHeader(part.blob);
      expect(header).toMatchObject({ riff: 'RIFF', rate: RATE, size: header.dataSize + 44 });
      expect(part.blob.type).toBe('audio/wav');
      total += header.dataSize;
    }
    expect(total).toBe(61 * 60 * RATE * 2);
    expect(parts.map(p => p.startSeconds)).toEqual([...parts.map(p => p.startSeconds)].sort((a, b) => a - b));
  });

  it('cuts a long MP3 on frame starts and estimates each part start from the duration', async () => {
    const frame = 400;
    const body = new Uint8Array(frame * 900);
    for (let at = 0; at < body.length; at += frame) body.set([0xff, 0xfb, 0x90, 0x64], at);
    const id3 = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0)]);
    const mp3 = new Blob([id3, body], { type: 'audio/mpeg' });
    const parts = (await planAudioChunks(mp3, 'audio/mpeg', 3600))!;
    expect(parts).toHaveLength(5);
    expect(parts.reduce((sum, p) => sum + p.blob.size, 0)).toBe(mp3.size);
    for (const part of parts.slice(1)) {
      const head = await bytesOf(part.blob.slice(0, 2));
      expect([...head]).toEqual([0xff, 0xfb]);
      expect(part.blob.type).toBe('audio/mpeg');
    }
    expect(parts[1].startSeconds).toBeGreaterThan(719);
    expect(parts[1].startSeconds).toBeLessThan(722);
  });
});

describe('shiftTimestamps', () => {
  it('moves square, round and Bengali-digit timestamps by the part start', () => {
    const text = '[00:05] **Speaker 1:** hi\n(১২:৩০) **Speaker 2:** ok [1:00:00]';
    expect(shiftTimestamps(text, 840)).toBe('[14:05] **Speaker 1:** hi\n(26:30) **Speaker 2:** ok [1:14:00]');
    expect(shiftTimestamps(text, 0)).toBe(text);
    expect(shiftTimestamps('[59:30] x', 60)).toBe('[1:00:30] x');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
