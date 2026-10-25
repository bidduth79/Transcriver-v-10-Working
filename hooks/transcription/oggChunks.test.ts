import { describe, it, expect } from 'vitest';
import { splitOggOpus } from './oggChunks';

// Ogg's CRC-32 (polynomial 0x04c11db7), written out bit by bit to check the splitter's table version
const crc = (b: Uint8Array) => {
  let c = 0;
  for (const byte of b) {
    c ^= byte << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    c >>>= 0;
  }
  return c;
};

const page = (seq: number, granule: bigint, payload: Uint8Array, flags = 0) => {
  const p = new Uint8Array(27 + 1 + payload.length);
  const v = new DataView(p.buffer);
  p.set([0x4f, 0x67, 0x67, 0x53], 0);
  p[5] = flags;
  v.setBigInt64(6, granule, true);
  v.setUint32(14, 7, true);
  v.setUint32(18, seq, true);
  p[26] = 1;
  p[27] = payload.length;
  p.set(payload, 28);
  v.setUint32(22, crc(p), true);
  return p;
};

const PRE_SKIP = 312;
// OpusHead (pre-skip 312), OpusTags, then one audio page per minute of 48 kHz audio
const opusFile = (minutes: number) => {
  const head = new Uint8Array(19);
  head.set([...'OpusHead'].map(c => c.charCodeAt(0)));
  head[8] = 1; head[9] = 1;
  new DataView(head.buffer).setUint16(10, PRE_SKIP, true);
  const tags = new Uint8Array([...'OpusTags'].map(c => c.charCodeAt(0)));
  const pages = [page(0, 0n, head, 0x02), page(1, 0n, tags)];
  for (let m = 1; m <= minutes; m++) pages.push(page(m + 1, BigInt(PRE_SKIP + m * 60 * 48000), new Uint8Array([m]), m === minutes ? 0x04 : 0));
  return new Blob(pages as BlobPart[], { type: 'audio/ogg' });
};

const readPages = (bytes: Uint8Array) => {
  const v = new DataView(bytes.buffer);
  const out = [];
  for (let at = 0; at < bytes.length; at += 28 + bytes[at + 27]) {
    const copy = bytes.slice(at, at + 28 + bytes[at + 27]);
    const stored = v.getUint32(at + 22, true);
    new DataView(copy.buffer).setUint32(22, 0, true);
    out.push({ seq: v.getUint32(at + 18, true), granule: v.getBigInt64(at + 6, true), flags: bytes[at + 5], crcOk: stored === crc(copy), byte: bytes[at + 28] });
  }
  return out;
};

describe('splitOggOpus', () => {
  it('leaves a recording under the limit alone, and anything that is not Ogg Opus', async () => {
    expect(await splitOggOpus(opusFile(20), 30 * 60, 14 * 60)).toBeNull();
    expect(await splitOggOpus(new Blob([new Uint8Array(100)]), 0, 60)).toBeNull();
  });

  it('cuts a long recording into complete Ogg files whose times start again at zero', async () => {
    const parts = (await splitOggOpus(opusFile(42), 30 * 60, 14 * 60))!;
    expect(parts.map(p => p.startSeconds)).toEqual([0, 14 * 60, 28 * 60]);
    for (const [k, part] of parts.entries()) {
      const pages = readPages(new Uint8Array(await part.blob.arrayBuffer()));
      expect(pages.every(p => p.crcOk)).toBe(true);
      expect(pages.map(p => p.seq)).toEqual(pages.map((_, i) => i));
      // Both header pages, then this part's 14 minutes
      expect(pages.slice(0, 2).map(p => p.granule)).toEqual([0n, 0n]);
      expect(pages.slice(2).map(p => p.byte)).toEqual(Array.from({ length: 14 }, (_, i) => k * 14 + i + 1));
      expect(pages[2].granule).toBe(BigInt(PRE_SKIP + 60 * 48000));
      expect(pages[pages.length - 1].flags & 0x04).toBe(0x04);
      expect(part.blob.type).toBe('audio/ogg');
    }
  });
});
