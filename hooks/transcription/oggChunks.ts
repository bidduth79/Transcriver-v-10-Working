// Splits a long Ogg Opus recording into parts without decoding it. Every part is a complete Ogg file:
// the original header pages, then whole audio pages with renumbered sequence numbers and times that
// start again at zero, each page with a fresh checksum. Memory stays low and the parts stay small.
import type { AudioChunk } from './audioChunks';

// Opus times are always counted in 48 kHz samples
const OPUS_RATE = 48000;
const NO_GRANULE = -1n;

interface OggPage {
  start: number;
  end: number;
  granule: bigint;
  continued: boolean;
  serial: number;
}

// Ogg's CRC-32: polynomial 0x04c11db7, not reflected, starting at 0
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

const oggCrc = (bytes: Uint8Array) => {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
  return crc;
};

const readPages = (bytes: Uint8Array): OggPage[] | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pages: OggPage[] = [];
  for (let at = 0; at + 27 <= bytes.length;) {
    if (bytes[at] !== 0x4f || bytes[at + 1] !== 0x67 || bytes[at + 2] !== 0x67 || bytes[at + 3] !== 0x53) return null;
    const segments = bytes[at + 26];
    let size = 27 + segments;
    for (let s = 0; s < segments; s++) size += bytes[at + 27 + s];
    if (at + size > bytes.length) break;
    pages.push({
      start: at, end: at + size, granule: view.getBigInt64(at + 6, true),
      continued: (bytes[at + 5] & 0x01) !== 0, serial: view.getUint32(at + 14, true),
    });
    at += size;
  }
  return pages;
};

// A copy of a page with a new sequence number and time, the end-of-stream flag if asked, and its checksum
const rewritePage = (bytes: Uint8Array, page: OggPage, sequence: number, granule: bigint, last: boolean) => {
  const copy = bytes.slice(page.start, page.end);
  const view = new DataView(copy.buffer);
  copy[5] = (copy[5] & ~0x04) | (last ? 0x04 : 0);
  if (granule !== NO_GRANULE) view.setBigInt64(6, granule, true);
  view.setUint32(18, sequence, true);
  view.setUint32(22, 0, true);
  view.setUint32(22, oggCrc(copy), true);
  return copy;
};

/**
 * Parts of about `partSeconds` each, cut where an audio page starts a fresh packet. Returns null when
 * the file is not a single-stream Ogg Opus recording or is shorter than `minSeconds`.
 */
export const splitOggOpus = async (blob: Blob, minSeconds: number, partSeconds: number): Promise<AudioChunk[] | null> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pages = readPages(bytes);
  if (!pages || pages.length < 3 || pages.some(p => p.serial !== pages[0].serial)) return null;
  // The first page's packet is OpusHead; its pre-skip says how many samples the decoder drops at the start
  const head = pages[0].start + 27 + bytes[pages[0].start + 26];
  if (String.fromCharCode(...bytes.subarray(head, head + 8)) !== 'OpusHead') return null;
  const preSkip = BigInt(new DataView(bytes.buffer, bytes.byteOffset).getUint16(head + 10, true));

  // Header pages (OpusHead, OpusTags) carry time 0; audio starts after them
  const headerCount = pages.findIndex(p => p.granule !== 0n);
  if (headerCount < 1) return null;
  const lastGranule = [...pages].reverse().find(p => p.granule > 0n)?.granule ?? 0n;
  const totalSeconds = Number(lastGranule - preSkip) / OPUS_RATE;
  if (totalSeconds < minSeconds) return null;

  // Cut before the first fresh page whose audio starts at or after each target time
  const partCount = Math.ceil(totalSeconds / partSeconds);
  const cuts = [headerCount];
  let previousEnd = 0n;
  for (let i = headerCount, k = 1; i < pages.length && k < partCount; i++) {
    const target = preSkip + BigInt(Math.round((totalSeconds * k / partCount) * OPUS_RATE));
    if (previousEnd >= target && !pages[i].continued && i > cuts[cuts.length - 1]) {
      cuts.push(i);
      k++;
    }
    if (pages[i].granule > 0n) previousEnd = pages[i].granule;
  }
  cuts.push(pages.length);

  const headers = pages.slice(0, headerCount);
  return cuts.slice(0, -1).map((from, k) => {
    const to = cuts[k + 1];
    // Time already played before this part (from the last page before it that ends a packet)
    const before = pages.slice(headerCount, from).reverse().find(p => p.granule > 0n)?.granule ?? preSkip;
    const base = from === headerCount ? 0n : before - preSkip;
    const out: Uint8Array[] = headers.map((p, s) => rewritePage(bytes, p, s, 0n, false));
    for (let i = from; i < to; i++) {
      const g = pages[i].granule;
      out.push(rewritePage(bytes, pages[i], headerCount + (i - from), g === NO_GRANULE ? g : g - base, i === to - 1));
    }
    return {
      blob: new Blob(out as BlobPart[], { type: 'audio/ogg' }),
      startSeconds: Number(base) / OPUS_RATE,
    };
  });
};
