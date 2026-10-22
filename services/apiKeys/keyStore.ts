import { getAllFromStore, addToStore, deleteFromStore } from '../db.ts';
import { STORES } from '../../constants/storeNames.ts';
import { useAppStore } from '../../hooks/useAppStore';
import { ACTIVE_KEY_ID_STORAGE } from './storageKeys';

export interface UserApiKey {
  id: string;
  key: string;
  label: string;
  addedAt: string;
}

export const newestFirst = (a: UserApiKey, b: UserApiKey) =>
  new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime();

export const addUserApiKey = async (key: string, label: string) => {
  const newKey: UserApiKey = {
    id: Date.now().toString(),
    key: key.trim(),
    label: label.trim() || `Key ${new Date().toLocaleTimeString()}`,
    addedAt: new Date().toISOString()
  };

  await addToStore(STORES.API_KEYS, newKey);

  // Automatically activate the newly added key so the user never stays stuck on an old blocked key
  localStorage.setItem(ACTIVE_KEY_ID_STORAGE, newKey.id);
  useAppStore.getState().triggerActiveApiKeyChanged();

  return newKey;
};

export const getAllApiKeys = async (): Promise<UserApiKey[]> => {
  try {
      const keys = await getAllFromStore(STORES.API_KEYS);
      if (!Array.isArray(keys)) return [];
      return keys.sort((a: UserApiKey, b: UserApiKey) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  } catch (e) {
      console.error("Error getting API keys:", e);
      return [];
  }
};

export const setActiveApiKey = (id: string) => {
  localStorage.setItem(ACTIVE_KEY_ID_STORAGE, id);
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const deleteApiKey = async (id: string) => {
  await deleteFromStore(STORES.API_KEYS, id);
  if (localStorage.getItem(ACTIVE_KEY_ID_STORAGE) === id) {
    localStorage.removeItem(ACTIVE_KEY_ID_STORAGE);
    useAppStore.getState().triggerActiveApiKeyChanged();
  }
};

export const getActiveKeyId = () => {
  return localStorage.getItem(ACTIVE_KEY_ID_STORAGE);
};
