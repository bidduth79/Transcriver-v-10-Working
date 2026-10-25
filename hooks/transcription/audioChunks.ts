// Splits a long WAV, MP3 or Ogg Opus recording into parts without decoding it: the parts are slices of
// the original file (plus a small header for WAV, rewritten pages for Ogg), so memory stays low.
import { splitOggOpus } from './oggChunks';

export const SPLIT_FROM_SECONDS = 30 * 60;
// Under 15 minutes, the limit of speech-only models when they separate speakers
export const CHUNK_SECONDS = 14 * 60;
// How far either side of a WAV cut to look for the quietest moment
const QUIET_SEARCH_SECONDS = 10;

export interface AudioChunk {
  blob: Blob;
  startSeconds: number;
}

const readBytes = async (blob: Blob, start: number, end: number) =>
  new Uint8Array(await blob.slice(Math.max(0, start), Math.min(blob.size, end)).arrayBuffer());

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

interface WavFormat {
  format: number; channels: number; sampleRate: number; byteRate: number; blockAlign: number; bits: number;
  dataStart: number; dataSize: number;
}

const readWavFormat = (head: Uint8Array, fileSize: number): WavFormat | null => {
  if (head.length < 12 || ascii(head, 0) !== 'RIFF' || ascii(head, 8) !== 'WAVE') return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  let fmt: Omit<WavFormat, 'dataStart' | 'dataSize'> | null = null;
  for (let at = 12; at + 8 <= head.length;) {
    const id = ascii(head, at);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ' && at + 24 <= head.length) {
      fmt = {
        format: view.getUint16(at + 8, true), channels: view.getUint16(at + 10, true), sampleRate: view.getUint32(at + 12, true),
        byteRate: view.getUint32(at + 16, true), blockAlign: view.getUint16(at + 20, true), bits: view.getUint16(at + 22, true),
      };
    } else if (id === 'data') {
      // Only plain PCM / float can be given a fresh 44-byte header
      if (!fmt || (fmt.format !== 1 && fmt.format !== 3) || !fmt.byteRate || !fmt.blockAlign) return null;
      return { ...fmt, dataStart: at + 8, dataSize: Math.min(size || Infinity, fileSize - at - 8) };
    }
    at += 8 + size + (size % 2);
  }
  return null;
};

const wavHeader = (f: WavFormat, dataSize: number) => {
  const view = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, f.format, true); view.setUint16(22, f.channels, true);
  view.setUint32(24, f.sampleRate, true); view.setUint32(28, f.byteRate, true);
  view.setUint16(32, f.blockAlign, true); view.setUint16(34, f.bits, true);
  text(36, 'data'); view.setUint32(40, dataSize, true);
  return view.buffer;
};

// Byte offset (inside the data) of the quietest 50 ms near `target` for 16-bit PCM; otherwise `target`
const quietestNear = async (blob: Blob, f: WavFormat, target: number) => {
  if (f.format !== 1 || f.bits !== 16) return target;
  const reach = Math.floor((QUIET_SEARCH_SECONDS * f.byteRate) / f.blockAlign) * f.blockAlign;
  const from = Math.max(0, target - reach);
  const bytes = await readBytes(blob, f.dataStart + from, f.dataStart + Math.min(f.dataSize, target + reach));
  const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const window = Math.max(1, Math.floor((f.sampleRate * f.channels) / 20));
  let best = target;
  let bestEnergy = Infinity;
  for (let start = 0; start + window <= samples.length; start += window) {
    let energy = 0;
    for (let i = start; i < start + window; i++) energy += samples[i] * samples[i];
    if (energy < bestEnergy) {
      bestEnergy = energy;
      best = from + (start + window / 2) * 2;
    }
  }
  return Math.floor(best / f.blockAlign) * f.blockAlign;
};

const splitWav = async (blob: Blob, f: WavFormat): Promise<AudioChunk[] | null> => {
  const duration = f.dataSize / f.byteRate;
  if (duration < SPLIT_FROM_SECONDS) return null;
  const parts = Math.ceil(duration / CHUNK_SECONDS);
  const cuts = [0];
  for (let k = 1; k < parts; k++) {
    const target = Math.floor((f.dataSize * k) / parts / f.blockAlign) * f.blockAlign;
    cuts.push(await quietestNear(blob, f, target));
  }
  cuts.push(f.dataSize);
  return cuts.slice(0, -1).map((start, k) => ({
    blob: new Blob([wavHeader(f, cuts[k + 1] - start), blob.slice(f.dataStart + start, f.dataStart + cuts[k + 1])], { type: 'audio/wav' }),
    startSeconds: start / f.byteRate,
  }));
};

const isMp3FrameStart = (b: Uint8Array, i: number) =>
  b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0 && ((b[i + 1] >> 1) & 3) !== 0 && (b[i + 2] >> 4) !== 0xf && ((b[i + 2] >> 2) & 3) !== 3;

// MP3 has no length table: cut points come from the known duration (a constant bitrate is assumed)
const splitMp3 = async (blob: Blob, head: Uint8Array, duration: number): Promise<AudioChunk[] | null> => {
  if (duration < SPLIT_FROM_SECONDS) return null;
  const audioStart = ascii(head, 0).startsWith('ID3')
    ? 10 + (((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f))
    : 0;
  const bytesPerSecond = (blob.size - audioStart) / duration;
  const parts = Math.ceil(duration / CHUNK_SECONDS);
  const cuts = [0];
  for (let k = 1; k < parts; k++) {
    const target = Math.floor(audioStart + ((blob.size - audioStart) * k) / parts);
    const near = await readBytes(blob, target, target + 8192);
    let offset = 0;
    while (offset + 3 < near.length && !isMp3FrameStart(near, offset)) offset++;
    cuts.push(target + offset);
  }
  cuts.push(blob.size);
  return cuts.slice(0, -1).map((start, k) => ({
    blob: blob.slice(start, cuts[k + 1], 'audio/mpeg'),
    startSeconds: k === 0 ? 0 : (start - audioStart) / bytesPerSecond,
  }));
};

/**
 * The parts to transcribe one by one, or null when the recording is short enough for one request or is
 * not a WAV, MP3 or Ogg Opus file (other formats cannot be cut without decoding them).
 */
export const planAudioChunks = async (blob: Blob, mimeType: string, durationSeconds: number): Promise<AudioChunk[] | null> => {
  const head = await readBytes(blob, 0, 65536);
  const wav = readWavFormat(head, blob.size);
  if (wav) return splitWav(blob, wav);
  if (ascii(head, 0) === 'OggS') return splitOggOpus(blob, SPLIT_FROM_SECONDS, CHUNK_SECONDS);
  const looksMp3 = /mpeg|mp3/.test(mimeType) || ascii(head, 0).startsWith('ID3') || isMp3FrameStart(head, 0);
  return looksMp3 && durationSeconds > 0 ? splitMp3(blob, head, durationSeconds) : null;
};
