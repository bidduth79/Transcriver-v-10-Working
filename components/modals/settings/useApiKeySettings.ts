import { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { UserApiKey, addUserApiKey, deleteApiKey, setActiveApiKey, getAllApiKeys, getActiveKeyId, getActiveModel, setActiveModel } from '../../../services/ApiKeyManager';
import { STORES } from '../../../services/db';

// Saved keys, active key/model and add/select/delete/model-change actions for the API Keys tab
export const useApiKeySettings = (appLang: 'bn' | 'en', addToast: (m: string, t: any) => void) => {
const [keyList, setKeyList] = useState<UserApiKey[]>([]);
const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
const [selectedModel, setSelectedModel] = useState<string>(getActiveModel());
const [newKeyInput, setNewKeyInput] = useState('');
const [newKeyLabel, setNewKeyLabel] = useState('');
const [isAddingKey, setIsAddingKey] = useState(false);
const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

const refreshKeys = async () => {
    try {
        const keys = await getAllApiKeys();
        const validKeys = (keys || []).filter(k => k && k.id);
        setKeyList(validKeys); 
        setActiveKeyId(getActiveKeyId());
    } catch (e) {
        console.error("Failed to refresh keys", e);
        setKeyList([]);
    }
};

useEffect(() => {
    refreshKeys();
}, []);

const apiKeysUpdates = useAppStore(state => state.storeUpdates[STORES.API_KEYS]);
const activeApiKeyChanged = useAppStore(state => state.activeApiKeyChanged);
useEffect(() => {
    refreshKeys();
    setSelectedModel(getActiveModel());
}, [apiKeysUpdates, activeApiKeyChanged]);

const handleAddKey = async () => {
    if (!newKeyInput.trim()) {
        addToast(appLang === 'bn' ? 'দয়া করে এপিআই কি দিন' : 'Please enter API Key', 'error');
        return;
    }
    setIsAddingKey(true);
    try {
        await addUserApiKey(newKeyInput, newKeyLabel || `Key ${keyList.length + 1}`);
        setNewKeyInput('');
        setNewKeyLabel('');
        await refreshKeys();
        addToast(appLang === 'bn' ? 'নতুন কি যুক্ত এবং সক্রিয় (Active) করা হয়েছে' : 'Key added and set as Active', 'success');
    } catch (e) {
        console.error(e);
        addToast('Failed to add key', 'error');
    } finally {
        setIsAddingKey(false);
    }
};

const handleSelectKey = (id: string) => {
    setActiveApiKey(id);
    setActiveKeyId(id);
    addToast(appLang === 'bn' ? 'এপিআই কি সিলেক্ট করা হয়েছে' : 'API Key Selected', 'success');
};

const handleDeleteKey = (id: string) => {
    setKeyToDelete(id);
};

const confirmDelete = async () => {
    if (keyToDelete) {
        await deleteApiKey(keyToDelete);
        await refreshKeys();
        addToast(appLang === 'bn' ? 'কি ডিলিট করা হয়েছে' : 'Key deleted', 'warning');
        setKeyToDelete(null);
    }
};

const handleModelChange = (modelId: string) => {
    setActiveModel(modelId);
    setSelectedModel(modelId);
    useAppStore.getState().triggerActiveApiKeyChanged();
    addToast(appLang === 'bn' ? `মডেল পরিবর্তন হয়েছে: ${modelId}` : `Model changed to: ${modelId}`, 'success');
};

  return {
    keyList, activeKeyId, selectedModel, newKeyInput, setNewKeyInput, newKeyLabel, setNewKeyLabel,
    isAddingKey, keyToDelete, setKeyToDelete, handleAddKey, handleSelectKey, handleDeleteKey, confirmDelete, handleModelChange,
  };
};
