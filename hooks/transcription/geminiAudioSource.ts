import type { FileState, GoogleGenAI, Part } from "../../types/gemini";
import { blobToBase64 } from './transcriptionUtils';

// Gemini rejects inline requests over 20 MB and base64 adds about a third, so larger audio goes through the Files API
export const INLINE_AUDIO_LIMIT = 14 * 1024 * 1024;
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;

const uploadAndWait = async (ai: GoogleGenAI, blob: Blob, mimeType: string) => {
  let file = await ai.files.upload({ file: blob, config: { mimeType } });
  for (let i = 0; file.state === 'PROCESSING' as FileState && i < MAX_POLLS; i++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== 'ACTIVE' as FileState || !file.uri || !file.name) {
    throw new Error('Gemini could not process the uploaded audio file');
  }
  return { name: file.name, uri: file.uri };
};

/**
 * Supplies the audio part of a Gemini request for a given API key.
 * Small audio is sent inline; large audio is uploaded once per key (an upload belongs to that
 * key's project) and the uploaded copies are deleted from Gemini by cleanup().
 */
export const createAudioSource = (blob: Blob, mimeType: string) => {
  const uploads = new Map<string, { ai: GoogleGenAI; name: string; uri: string }>();

  const partFor = async (ai: GoogleGenAI, apiKey: string): Promise<Part> => {
    if (blob.size <= INLINE_AUDIO_LIMIT) {
      return { inlineData: { mimeType, data: await blobToBase64(blob) } };
    }
    let upload = uploads.get(apiKey);
    if (!upload) {
      upload = { ai, ...(await uploadAndWait(ai, blob, mimeType)) };
      uploads.set(apiKey, upload);
    }
    return { fileData: { fileUri: upload.uri, mimeType } };
  };

  const cleanup = async () => {
    const pending = [...uploads.values()];
    uploads.clear();
    for (const upload of pending) {
      try {
        await upload.ai.files.delete({ name: upload.name });
      } catch (err) {
        console.warn("Could not delete file from Gemini server:", err);
      }
    }
  };

  return { partFor, cleanup };
};

export type AudioSource = ReturnType<typeof createAudioSource>;
