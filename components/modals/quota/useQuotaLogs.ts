import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { getApiCallLogs, getActiveModel, ApiCallLog } from '../../../services/ApiKeyManager';

// API call logs + active model, refreshed every 5s (paused while the tab is hidden) and on store events.
// `tick` changes on every refresh so time-based stats are recomputed even when logs are unchanged.
export const useQuotaLogs = () => {
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [tick, setTick] = useState(0);

  const fetchLogs = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const allLogs = await getApiCallLogs();
    const currentModel = getActiveModel();
    setLogs(prev => {
      if (
        prev.length === allLogs.length &&
        prev[prev.length - 1]?.id === allLogs[allLogs.length - 1]?.id
      ) {
        return prev;
      }
      return allLogs;
    });
    setActiveModel(prev => (prev === currentModel ? prev : currentModel));
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    fetchLogs();

    const interval = setInterval(fetchLogs, 5000);
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchLogs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchLogs]);

  const apiCallLogged = useAppStore(state => state.apiCallLogged);
  const activeApiKeyChanged = useAppStore(state => state.activeApiKeyChanged);

  useEffect(() => {
    fetchLogs();
  }, [apiCallLogged, activeApiKeyChanged, fetchLogs]);

  return { logs, activeModel, tick };
};
