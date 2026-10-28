import type {
  GenerateContentParameters,
  GenerateContentResponse,
  GeminiFileMetadata,
} from '../../types/gemini';

const buildHttpError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

const readErrorPayload = async (res: Response): Promise<never> => {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error?.message) {
      msg = body.error.message;
    } else if (typeof body?.error === 'string') {
      msg = body.error;
    }
  } catch {
    // Non-JSON error body
  }
  throw buildHttpError(msg, res.status);
};

export const requestGenerateContent = async (
  apiKey: string,
  params: GenerateContentParameters
): Promise<GenerateContentResponse> => {
  const { abortSignal, ...restConfig } = params.config ?? {};
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: params.model,
      contents: params.contents,
      config: Object.keys(restConfig).length > 0 ? restConfig : undefined,
    }),
    signal: abortSignal,
  });
  if (!res.ok) return readErrorPayload(res);
  return (await res.json()) as GenerateContentResponse;
};

export const requestUploadFile = async (
  apiKey: string,
  params: { file: Blob; config?: { mimeType?: string } }
): Promise<GeminiFileMetadata> => {
  const mimeType = params.config?.mimeType || params.file.type || 'audio/mpeg';
  const res = await fetch('/api/gemini/files/upload', {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Gemini-Mime-Type': mimeType,
      'X-Gemini-Key': apiKey,
    },
    body: params.file,
  });
  if (!res.ok) return readErrorPayload(res);
  return (await res.json()) as GeminiFileMetadata;
};

export const requestGetFile = async (
  apiKey: string,
  params: { name: string }
): Promise<GeminiFileMetadata> => {
  const res = await fetch('/api/gemini/files/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, name: params.name }),
  });
  if (!res.ok) return readErrorPayload(res);
  return (await res.json()) as GeminiFileMetadata;
};

export const requestDeleteFile = async (
  apiKey: string,
  params: { name: string }
): Promise<unknown> => {
  const res = await fetch('/api/gemini/files/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, name: params.name }),
  });
  if (!res.ok) return readErrorPayload(res);
  return res.json();
};
