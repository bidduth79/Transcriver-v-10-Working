import type { ApiCallLog } from '../../../services/ApiKeyManager';
import { pacificDayIndex, pacificDayStart } from './pacificDay';

const MINUTE_MS = 60000;

export interface QuotaLimits { rpm: number; tpm: number; rpd: number }

const CUSTOM_LIMITS_KEY = 'quota_limits_by_model';

// Rough free-tier guesses ("pro" models are much stricter). Google no longer publishes per-model numbers;
// each project's real limits are shown in AI Studio, and the user can enter them (saveModelLimits).
export const estimatedLimits = (modelId: string): QuotaLimits =>
  modelId.includes('pro') ? { rpm: 2, tpm: 32000, rpd: 50 } : { rpm: 15, tpm: 1000000, rpd: 1500 };

const readCustomLimits = (): Record<string, QuotaLimits> => {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_LIMITS_KEY) || '{}');
  } catch {
    return {};
  }
};

export const hasCustomLimits = (modelId: string) => !!readCustomLimits()[modelId];

export const getModelLimits = (modelId: string): QuotaLimits => readCustomLimits()[modelId] ?? estimatedLimits(modelId);

// Saves the user's real limits for a model; null goes back to the estimate
export const saveModelLimits = (modelId: string, limits: QuotaLimits | null) => {
  const all = readCustomLimits();
  if (limits) all[modelId] = limits; else delete all[modelId];
  localStorage.setItem(CUSTOM_LIMITS_KEY, JSON.stringify(all));
};

// 1500 → "1.5K", 1000000 → "1M"
export const formatQuotaNumber = (num: number) =>
  num >= 1000000 ? (num/1000000).toFixed(1).replace('.0','') + 'M' : num >= 1000 ? (num/1000).toFixed(1).replace('.0','') + 'K' : num;

// TPM limits count input tokens, as reported by Gemini for each request
const tokensOf = (log: ApiCallLog) => log.promptTokens ?? log.tokens ?? 0;

/**
 * Requests that count against the quota of one model on one key: requests Gemini refused with 429
 * are left out, and so are other keys' requests (quota is per project; keys are told apart by their
 * last 4 characters). Older log entries without a key are kept.
 */
export const quotaLogsFor = (logs: ApiCallLog[], model: string, keyTail?: string) =>
  logs.filter(l => !l.rateLimited && l.model === model && (!keyTail || !l.keyTail || l.keyTail === keyTail));

// Usage in the last minute (RPM/TPM) and since midnight Pacific time (RPD), as counts and % of limit
export const computeCurrentUsage = (logs: ApiCallLog[], limits: QuotaLimits, now: number) => {
  const rpmLogs = logs.filter(l => now - new Date(l.timestamp).getTime() < MINUTE_MS);
  const dayStart = pacificDayStart(now);
  const rpdLogs = logs.filter(l => new Date(l.timestamp).getTime() >= dayStart);

  const rpmCount = rpmLogs.length;
  const tpmCount = rpmLogs.reduce((acc, l) => acc + tokensOf(l), 0);
  const rpdCount = rpdLogs.length;

  return {
    rpmCount, tpmCount, rpdCount,
    rpmPercent: Math.min((rpmCount / limits.rpm) * 100, 100),
    tpmPercent: Math.min((tpmCount / limits.tpm) * 100, 100),
    rpdPercent: Math.min((rpdCount / limits.rpd) * 100, 100),
  };
};

// All-time peaks per minute/day, plus bar-chart history for the last 30 minutes and 7 days
export const computePeakTrends = (logs: ApiCallLog[], now: number) => {
  if (logs.length === 0) return { peakRpm: 0, peakTpm: 0, peakRpd: 0, rpmHistory: Array(30).fill(0), tpmHistory: Array(30).fill(0), rpdHistory: Array(7).fill(0) };

  const minuteGroups: Record<number, { requests: number, tokens: number }> = {};
  const dayGroups: Record<number, number> = {};

  logs.forEach(log => {
    const time = new Date(log.timestamp).getTime();
    const minKey = Math.floor(time / MINUTE_MS);
    const dayKey = pacificDayIndex(time);

    if (!minuteGroups[minKey]) minuteGroups[minKey] = { requests: 0, tokens: 0 };
    minuteGroups[minKey].requests += 1;
    minuteGroups[minKey].tokens += tokensOf(log);

    if (!dayGroups[dayKey]) dayGroups[dayKey] = 0;
    dayGroups[dayKey] += 1;
  });

  let peakRpm = 0;
  let peakTpm = 0;
  let peakRpd = 0;
  Object.values(minuteGroups).forEach(g => {
    if (g.requests > peakRpm) peakRpm = g.requests;
    if (g.tokens > peakTpm) peakTpm = g.tokens;
  });
  Object.values(dayGroups).forEach(count => {
    if (count > peakRpd) peakRpd = count;
  });

  const currentMin = Math.floor(now / MINUTE_MS);
  const rpmHistory: number[] = [];
  const tpmHistory: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const group = minuteGroups[currentMin - i] || { requests: 0, tokens: 0 };
    rpmHistory.push(group.requests);
    tpmHistory.push(group.tokens);
  }

  const currentDay = pacificDayIndex(now);
  const rpdHistory: number[] = [];
  for (let i = 6; i >= 0; i--) {
    rpdHistory.push(dayGroups[currentDay - i] || 0);
  }

  return { peakRpm, peakTpm, peakRpd, rpmHistory, tpmHistory, rpdHistory };
};
