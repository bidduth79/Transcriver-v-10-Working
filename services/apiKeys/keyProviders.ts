import { getApiUrl } from '../api.ts';
import { isLocalServerEnabled } from '../../utils/config';
import { getAllFromStore } from '../db.ts';
import { STORES } from '../../constants/storeNames.ts';
import { useAppStore } from '../../hooks/useAppStore';
import { ACTIVE_KEY_ID_STORAGE } from './storageKeys';
import { getActiveModel } from './modelSettings';
import { newestFirst, type UserApiKey } from './keyStore';

const getEnvApiKey = (): { key: string; source: string } | null => {
  const env = import.meta.env;
  const envKey = env ? (env.VITE_API_KEY_1 || env.VITE_GEMINI_API_KEY) : undefined;

  if (envKey && typeof envKey === 'string' && envKey.trim() !== '') {
    return {
      key: envKey.trim(),
      source: 'Environment (.env)'
    };
  }

  return null;
};

// Key priority: manually selected → newest saved key → .env → local PHP server → server-managed Gemini key
export const getActiveProvider = async () => {
  const activeId = localStorage.getItem(ACTIVE_KEY_ID_STORAGE);
  const currentModel = getActiveModel();

  if (activeId) {
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

  const envProvider = getEnvApiKey();
  if (envProvider) {
    return {
      id: 'env',
      key: envProvider.key,
      model: currentModel,
      source: envProvider.source
    };
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
 * Returns alternative API keys (other saved keys + .env key + server key) when the primary key fails
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

  const envProvider = getEnvApiKey();
  if (envProvider && !seenKeys.has(envProvider.key)) {
    seenKeys.add(envProvider.key);
    fallbacks.push({
      id: 'env',
      key: envProvider.key,
      source: envProvider.source
    });
  }

  if (import.meta.env.MODE !== 'test' && !seenKeys.has('SERVER_KEY')) {
    seenKeys.add('SERVER_KEY');
    fallbacks.push({
      id: 'server',
      key: 'SERVER_KEY',
      source: 'Environment (Process)'
    });
  }

  return fallbacks;
};
