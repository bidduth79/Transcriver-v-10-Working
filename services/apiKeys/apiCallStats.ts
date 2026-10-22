import { useAppStore } from '../../hooks/useAppStore';

export interface ApiCallLog {
  id: string;
  timestamp: string;
  source: string;
  model: string;
  status: 'success' | 'error';
  latency?: number;
  tokens?: number;
}

const logApiCall = (status: 'success' | 'error', model: string = 'unknown', tokens: number = 0) => {
  try {
    const logsStr = localStorage.getItem('api_call_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      model,
      status,
      tokens
    });
    // keep only last 2000
    if (logs.length > 2000) logs.shift();
    localStorage.setItem('api_call_logs', JSON.stringify(logs));
    useAppStore.getState().triggerApiCallLogged();
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
};

// `source` and `keySource` are accepted for call-site compatibility but not stored
export const incrementTotalCalls = async (_source = 'Unknown', model = 'Unknown', _keySource = 'Unknown', tokens = 0) => {
  let count = parseInt(localStorage.getItem('simple_api_count') || '0');
  count++;
  localStorage.setItem('simple_api_count', count.toString());
  logApiCall('success', model, tokens);
  return count;
};

export const getTotalCalls = async () => {
  return parseInt(localStorage.getItem('simple_api_count') || '0');
};

export const getApiCallLogs = async (): Promise<ApiCallLog[]> => {
  try {
    const logsStr = localStorage.getItem('api_call_logs');
    return logsStr ? JSON.parse(logsStr) : [];
  } catch(e) {
    return [];
  }
};
