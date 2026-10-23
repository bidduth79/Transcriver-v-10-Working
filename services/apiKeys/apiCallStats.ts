import { useAppStore } from '../../hooks/useAppStore';

export interface ApiCallLog {
  id: string;
  timestamp: string;
  source: string;
  model: string;
  status: 'success' | 'error';
  latency?: number;
  tokens?: number;
  // Written for every real Gemini request by services/apiKeys/geminiClient.ts
  keyTail?: string;
  promptTokens?: number;
  rateLimited?: boolean;
}

export interface ApiCallEntry {
  status: 'success' | 'error';
  model: string;
  keyTail?: string;
  promptTokens?: number;
  tokens?: number;
  latency?: number;
  rateLimited?: boolean;
}

let lastLogId = 0;

export const logApiCall = (entry: ApiCallEntry) => {
  try {
    const logsStr = localStorage.getItem('api_call_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    // Unique even for several requests within one millisecond
    lastLogId = Math.max(Date.now(), lastLogId + 1);
    logs.push({ id: String(lastLogId), timestamp: new Date().toISOString(), ...entry });
    // keep only last 2000
    if (logs.length > 2000) logs.shift();
    localStorage.setItem('api_call_logs', JSON.stringify(logs));
    useAppStore.getState().triggerApiCallLogged();
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
};

// Counts finished features (one transcription, one summary...). Each underlying Gemini request is
// logged separately by the Gemini client, so the arguments are kept only for call-site compatibility.
export const incrementTotalCalls = async (_source = 'Unknown', _model = 'Unknown', _keySource = 'Unknown', _tokens = 0) => {
  let count = parseInt(localStorage.getItem('simple_api_count') || '0');
  count++;
  localStorage.setItem('simple_api_count', count.toString());
  useAppStore.getState().triggerApiCallLogged();
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
