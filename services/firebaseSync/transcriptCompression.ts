import { Bytes } from 'firebase/firestore';
import { STORES } from '../../constants/storeNames';

/**
 * History transcripts are gzipped in Firestore (Bengali text shrinks about 5x). This keeps long
 * transcripts under Firestore's 1 MB document limit and the whole backup well inside the free 1 GB.
 * Local IndexedDB (and other sync targets) keep the plain text.
 */
export const COMPRESS_FROM_BYTES = 20 * 1024;
// Above this a plain transcript could not have been saved to Firestore (1 MiB per document)
export const NEAR_DOC_LIMIT_BYTES = 900 * 1024;
const GZIP_FIELD = 'transcriptGz';

export const utf8Length = (text: string) => new TextEncoder().encode(text).length;

const pipe = async (data: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Response(data as BodyInit).body!.pipeThrough(stream)).arrayBuffer());

export const gzipText = (text: string) => pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));
export const gunzipText = async (data: Uint8Array) => new TextDecoder().decode(await pipe(data, new DecompressionStream('gzip')));

// Before saving to Firestore: a long history transcript is stored as gzipped bytes
export const packForCloud = async (storeName: string, payload: Record<string, unknown>) => {
  const { transcript } = payload;
  if (storeName !== STORES.HISTORY || typeof transcript !== 'string' || utf8Length(transcript) < COMPRESS_FROM_BYTES) {
    return payload;
  }
  const { transcript: _plain, ...rest } = payload;
  return { ...rest, [GZIP_FIELD]: Bytes.fromUint8Array(await gzipText(transcript)) };
};

// After reading from Firestore: restore the plain transcript (works with full and Lite SDK bytes)
export const unpackFromCloud = async <T extends Record<string, unknown>>(data: T): Promise<T> => {
  // Bytes from either SDK: only their toUint8Array() is used
  const packed = data[GZIP_FIELD] as { toUint8Array?: () => Uint8Array } | undefined;
  if (!packed || typeof packed.toUint8Array !== 'function') return data;
  const { [GZIP_FIELD]: _gz, ...rest } = data;
  return { ...rest, transcript: await gunzipText(packed.toUint8Array()) } as unknown as T;
};

// A cloud history document that should be re-sent compressed
export const isLargePlainTranscript = (data: Record<string, unknown>) =>
  typeof data.transcript === 'string' && utf8Length(data.transcript) >= COMPRESS_FROM_BYTES;
