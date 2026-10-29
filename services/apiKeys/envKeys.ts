// The .env Gemini keys as the server lists them: an id, a label and a token ("env:env-2:a3F9") that the server
// turns back into the key. The keys themselves never reach the browser.
export interface EnvKeyInfo {
  id: string;
  label: string;
  token: string;
}

let listPromise: Promise<EnvKeyInfo[]> | null = null;

const readKeys = async (res: Response) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { keys?: EnvKeyInfo[] };
  return Array.isArray(data.keys) ? data.keys : [];
};

// Asked once, then kept; without the server (e.g. a static preview) there are simply no .env keys
export const listEnvKeys = () => {
  listPromise ??= fetch('/api/keys').then(readKeys).catch(() => {
    listPromise = null;
    return [];
  });
  return listPromise;
};

// After .env was edited: the server reads it again
export const reloadEnvKeys = async () => {
  const keys = await fetch('/api/keys/reload', { method: 'POST' }).then(readKeys);
  listPromise = Promise.resolve(keys);
  return keys;
};

// Whether a key works; checking it spends no quota
export const testEnvKey = async (token: string): Promise<{ ok: boolean; message?: string }> => {
  const res = await fetch('/api/keys/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return (await res.json()) as { ok: boolean; message?: string };
};

export const isEnvKeyId = (id: string) => id.startsWith('env-');
