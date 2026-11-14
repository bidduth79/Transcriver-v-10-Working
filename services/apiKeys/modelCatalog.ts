// Google's list of the models a key can use (asked through the app's server; listing spends no quota), narrowed to
// the ones that can transcribe: Gemini models that answer generateContent, without image, speech-out, live,
// agent and other special models.
export interface GoogleModel {
  id: string;
  label: string;
  inputTokenLimit?: number;
}

const NOT_FOR_TRANSCRIPTION = /image|tts|embedding|live|robotics|computer-use|native-audio|deep-research|antigravity|customtools|banana|decision|aqa/i;

export const listGoogleModels = async (key: string): Promise<GoogleModel[]> => {
  const res = await fetch('/api/gemini/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message ?? `HTTP ${res.status}`));
  const models: { id: string; label: string; inputTokenLimit?: number; actions?: string[] }[] = Array.isArray(data.models) ? data.models : [];
  return models
    .filter(m => m.id.startsWith('gemini-') && (m.actions ?? []).includes('generateContent') && !NOT_FOR_TRANSCRIPTION.test(m.id))
    .map(({ id, label, inputTokenLimit }) => ({ id, label: label || id, inputTokenLimit }));
};
