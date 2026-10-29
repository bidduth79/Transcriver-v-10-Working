import { useState, useEffect } from 'react';
import { listEnvKeys, reloadEnvKeys, testEnvKey, type EnvKeyInfo } from '../../../services/apiKeys/envKeys';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

// The .env keys the server holds: list, read .env again, and check a key without spending quota
export const useEnvKeySettings = (appLang: string, addToast: (m: string, t: ToastType) => void) => {
  const [envKeys, setEnvKeys] = useState<EnvKeyInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listEnvKeys().then(keys => { if (alive) setEnvKeys(keys); });
    return () => { alive = false; };
  }, []);

  const reload = async () => {
    setBusyId('reload');
    try {
      const keys = await reloadEnvKeys();
      setEnvKeys(keys);
      addToast(uiText(appLang, 'envKeysReloaded', { count: keys.length }), 'success');
    } catch {
      addToast(uiText(appLang, 'envKeysServerMissing'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const test = async (key: EnvKeyInfo) => {
    setBusyId(key.id);
    try {
      const result = await testEnvKey(key.token);
      if (result.ok) addToast(uiText(appLang, 'envKeyWorks', { label: key.label }), 'success');
      else addToast(uiText(appLang, 'envKeyFailed', { label: key.label, message: result.message ?? '' }), 'error');
    } catch {
      addToast(uiText(appLang, 'envKeysServerMissing'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return { envKeys, busyId, reload, test };
};
