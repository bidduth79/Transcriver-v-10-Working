import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  Bytes: { fromUint8Array: (u: Uint8Array) => ({ bytes: u, toUint8Array: () => u }) },
}));

import { packForCloud, unpackFromCloud, isLargePlainTranscript, COMPRESS_FROM_BYTES, utf8Length } from './transcriptCompression';

const bengali = (bytes: number) => 'সীমান্তে টহল চলছে। '.repeat(Math.ceil(bytes / 50));

describe('transcriptCompression', () => {
  it('stores a long history transcript gzipped and restores it exactly', async () => {
    const transcript = bengali(200 * 1024);
    const packed: any = await packForCloud('studio_history', { id: 'a', fileName: 'f.mp3', transcript });
    expect(packed).not.toHaveProperty('transcript');
    expect(packed.fileName).toBe('f.mp3');
    expect(packed.transcriptGz.bytes.length).toBeLessThan(utf8Length(transcript) / 4);
    expect(await unpackFromCloud(packed)).toEqual({ id: 'a', fileName: 'f.mp3', transcript });
  });

  it('leaves short transcripts, other stores and plain cloud documents unchanged', async () => {
    const short = { id: 'b', transcript: bengali(COMPRESS_FROM_BYTES / 2) };
    expect(await packForCloud('studio_history', short)).toBe(short);
    const report = { id: 'r', transcript: bengali(COMPRESS_FROM_BYTES * 2) };
    expect(await packForCloud('studio_reports', report)).toBe(report);
    expect(await unpackFromCloud(short)).toBe(short);
  });

  it('flags long plain transcripts that should be re-sent compressed', () => {
    expect(isLargePlainTranscript({ transcript: bengali(COMPRESS_FROM_BYTES * 2) })).toBe(true);
    expect(isLargePlainTranscript({ transcript: 'short' })).toBe(false);
    expect(isLargePlainTranscript({ transcriptGz: {} })).toBe(false);
  });
});
