import { getApiUrl } from '../api.ts';
import { isLocalServerEnabled } from '../../utils/config';
import { getAllFromStore } from '../db.ts';
import { STORES } from '../../constants/storeNames.ts';
import { useAppStore } from '../../hooks/useAppStore';
import { ACTIVE_KEY_ID_STORAGE } from './storageKeys';
import { getActiveModel } from './modelSettings';
import { newestFirst, type UserApiKey } from './keyStore';
import { listEnvKeys, isEnvKeyId } from './envKeys';

// Key priority: manually selected → newest key saved in the browser → .env keys (kept on the server)
// → local PHP server → server-managed Gemini key
export const getActiveProvider = async () => {
  const activeId = localStorage.getItem(ACTIVE_KEY_ID_STORAGE);
  const currentModel = getActiveModel();
  const envKeys = await listEnvKeys();

  if (activeId && isEnvKeyId(activeId)) {
    const selected = envKeys.find(k => k.id === activeId);
    if (selected) return { id: selected.id, key: selected.token, model: currentModel, source: selected.label };
    // No longer in .env
    localStorage.removeItem(ACTIVE_KEY_ID_STORAGE);
    useAppStore.getState().triggerActiveApiKeyChanged();
  } else if (activeId) {
    try {
      const allKeys = await getAllFromStore(STORES.API_KEYS);
      if (Array.isArray(allKeys)) {
          const selectedKey = allKeys.find((k: UserApiKey) => k.id === activeId);
          if (selectedKey && selectedKey.key) {
            return {
              id: selectedKey.id,
              key: selectedKey.key.trim(),
              model: currentModel,
              source: selectedKey.label || 'Manual Selection'
            };
          } else {
            // Key not found in DB, clean up localStorage
            localStorage.removeItem(ACTIVE_KEY_ID_STORAGE);
            useAppStore.getState().triggerActiveApiKeyChanged();
          }
      }
    } catch (e) {
      console.error("Error fetching active key:", e);
    }
  }

  // Fallback to the newest available key in IndexedDB if activeId was not set
  try {
    const allKeys = await getAllFromStore(STORES.API_KEYS);
    if (Array.isArray(allKeys) && allKeys.length > 0) {
      const sorted = [...allKeys].sort(newestFirst);
      if (sorted[0]?.key) {
        localStorage.setItem(ACTIVE_KEY_ID_STORAGE, sorted[0].id);
        return {
          id: sorted[0].id,
          key: sorted[0].key.trim(),
          model: currentModel,
          source: sorted[0].label || 'Default Key'
        };
      }
    }
  } catch (e) {
    // Ignore
  }

  if (envKeys.length > 0) {
    return { id: envKeys[0].id, key: envKeys[0].token, model: currentModel, source: envKeys[0].label };
  }

  if (isLocalServerEnabled()) {
    try {
        const response = await fetch(getApiUrl('get_api_key.php'));
        if (response.ok) {
            const data = await response.json();
            if (data && data.key) {
                return {
                    id: 'local_server',
                    key: data.key.trim(),
                    model: currentModel,
                    source: 'Server Master Key'
                };
            }
        }
    } catch (e) {
        // Ignore
    }
  }

  if (import.meta.env.MODE !== 'test') {
    return {
      id: 'server',
      key: 'SERVER_KEY',
      model: currentModel,
      source: 'Environment (Process)'
    };
  }

  return null;
};

/**
 * Returns alternative API keys (other saved keys, then the .env keys, then the server key) when the primary key fails
 * with "project has been denied access" (403) or quota exhaustion (429).
 */
export const getFallbackProviders = async (failedKey: string): Promise<{ id: string; key: string; source: string }[]> => {
  const fallbacks: { id: string; key: string; source: string }[] = [];
  const seenKeys = new Set<string>([failedKey.trim()]);

  try {
    const allKeys = await getAllFromStore(STORES.API_KEYS);
    if (Array.isArray(allKeys)) {
      const sorted = [...allKeys].sort(newestFirst);
      for (const k of sorted) {
        const trimmed = (k?.key || '').trim();
        if (trimmed && !seenKeys.has(trimmed)) {
          seenKeys.add(trimmed);
          fallbacks.push({
            id: k.id,
            key: trimmed,
            source: k.label || 'Saved Key'
          });
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // The .env keys come after the browser's, in their .env order
  const envKeys = await listEnvKeys();
  for (const envKey of envKeys) {
    if (!seenKeys.has(envKey.token)) {
      seenKeys.add(envKey.token);
      fallbacks.push({ id: envKey.id, key: envKey.token, source: envKey.label });
    }
  }

  // The server's own key is the first .env key, already tried above when there is one
  if (envKeys.length === 0 && import.meta.env.MODE !== 'test' && !seenKeys.has('SERVER_KEY')) {
    seenKeys.add('SERVER_KEY');
    fallbacks.push({
      id: 'server',
      key: 'SERVER_KEY',
      source: 'Environment (Process)'
    });
  }

  return fallbacks;
};
