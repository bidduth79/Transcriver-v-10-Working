// Gemini keys kept only on the server: GEMINI_API_KEY_1, GEMINI_API_KEY_2, … in .env (or the host's secrets,
// e.g. AI Studio), each with an optional GEMINI_API_KEY_1_LABEL. The browser only ever sees a token such as
// "env:env-2:a3F9" (id and the key's last four characters), never the key itself.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export interface EnvKey {
  id: string;
  label: string;
  key: string;
}

const TOKEN_PREFIX = 'env:';
// Older single-key names still work, after the numbered keys
const LEGACY_NAMES = ['GEMINI_API_KEY', 'API_KEY', 'VITE_GEMINI_API_KEY', 'VITE_API_KEY_1'];

export const collectEnvKeys = (env: Record<string, string | undefined>): EnvKey[] => {
  const keys: EnvKey[] = [];
  const add = (id: string, value: string | undefined, label: string) => {
    const key = value?.trim();
    if (key && !keys.some(k => k.key === key)) keys.push({ id, label, key });
  };
  const numbers = Object.keys(env)
    .map(name => /^GEMINI_API_KEY_(\d+)$/.exec(name)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  for (const n of numbers) add(`env-${n}`, env[`GEMINI_API_KEY_${n}`], env[`GEMINI_API_KEY_${n}_LABEL`]?.trim() || `.env ${n}`);
  for (const name of LEGACY_NAMES) add(`env-${name.toLowerCase()}`, env[name], name);
  return keys;
};

// The .env file is read here (the server does not load it otherwise), so a reload picks up edits at once
const readEnv = (envFile: string) => ({ ...process.env, ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}) });

let cached: EnvKey[] | null = null;
export const loadEnvKeys = (envFile = '.env') => (cached = collectEnvKeys(readEnv(envFile)));
export const getEnvKeys = () => cached ?? loadEnvKeys();

export const envKeyToken = (key: EnvKey) => `${TOKEN_PREFIX}${key.id}:${key.key.slice(-4)}`;

// What the browser may know about the keys
export const publicEnvKeys = () => getEnvKeys().map(key => ({ id: key.id, label: key.label, token: envKeyToken(key) }));

// The key behind a token from the browser; undefined for anything else (a key saved in the browser)
export const keyFromToken = (token: string) => {
  if (!token.startsWith(TOKEN_PREFIX)) return undefined;
  const id = token.slice(TOKEN_PREFIX.length).split(':')[0];
  return getEnvKeys().find(key => key.id === id)?.key;
};
