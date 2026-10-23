import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  store: [] as any[],
  localServer: { value: false },
  triggerActiveApiKeyChanged: vi.fn(),
  triggerApiCallLogged: vi.fn(),
}));

vi.mock('./db.ts', () => ({
  getAllFromStore: vi.fn(async () => m.store),
  addToStore: vi.fn(async (_s: string, item: any) => { m.store.push(item); }),
  deleteFromStore: vi.fn(async (_s: string, id: string) => { m.store = m.store.filter(k => k.id !== id); }),
}));
vi.mock('./api.ts', () => ({ getApiUrl: (p: string) => `http://local/${p}` }));
vi.mock('../utils/config', () => ({ isLocalServerEnabled: () => m.localServer.value }));
vi.mock('../hooks/useAppStore', () => ({
  useAppStore: { getState: () => ({ triggerActiveApiKeyChanged: m.triggerActiveApiKeyChanged, triggerApiCallLogged: m.triggerApiCallLogged }) },
}));

import * as AKM from './ApiKeyManager';
import { logApiCall } from './apiKeys/apiCallStats';

const key = (id: string, k: string, label: string, addedAt: string) => ({ id, key: k, label, addedAt });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.store = [];
  m.localServer.value = false;
  vi.stubEnv('VITE_API_KEY_1', '');
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('model settings', () => {
  it('exposes model catalog and definitions', () => {
    expect(AKM.DEFAULT_MODEL).toBe('gemini-3.8-flash');
    expect(AKM.AVAILABLE_MODELS.map(x => x.id)).toEqual([
      'gemini-3.5-transcribe', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-pro-preview',
    ]);
    expect(AKM.MODEL_CATEGORY_GROUPS.map(g => g.id)).toEqual(['fast', 'balanced', 'thinking']);
    expect(AKM.getModelDefinition('gemini-3.1-pro-preview').category).toBe('thinking');
    expect(AKM.getModelDefinition('unknown').id).toBe('gemini-3.8-flash');
    expect(JSON.stringify(AKM.AVAILABLE_MODELS).length).toMatchInlineSnapshot(`2851`);
  });

  it('stores active model and speed mode', () => {
    expect(AKM.getActiveModel()).toBe('gemini-3.8-flash');
    // A saved model that Google retired falls back to the default
    localStorage.setItem('manual_active_model', 'gemini-2.5-flash');
    expect(AKM.getActiveModel()).toBe('gemini-3.8-flash');
    expect(AKM.isSpeedOptimizationEnabled()).toBe(true);
    AKM.setActiveModel('gemini-3.5-flash');
    expect(AKM.getActiveModel()).toBe('gemini-3.5-flash');
    AKM.setSpeedOptimizationEnabled(false);
    expect(localStorage.getItem('transcription_speed_opt_mode')).toBe('classic');
    expect(AKM.isSpeedOptimizationEnabled()).toBe(false);
    AKM.setSpeedOptimizationEnabled(true);
    expect(localStorage.getItem('transcription_speed_opt_mode')).toBe('optimized');
    AKM.resetModelToClassicDefault();
    expect(AKM.getActiveModel()).toBe('gemini-3.8-flash');
    expect(AKM.isSpeedOptimizationEnabled()).toBe(false);
    expect(m.triggerActiveApiKeyChanged).toHaveBeenCalledTimes(4);
  });
});

describe('getActiveProvider', () => {
  it('returns the manually selected key', async () => {
    m.store = [key('1', ' AAA ', 'First', '2026-01-01'), key('2', 'BBB', '', '2026-02-01')];
    AKM.setActiveApiKey('2');
    AKM.setActiveModel('gemini-3.5-flash');
    expect(await AKM.getActiveProvider()).toEqual({ id: '2', key: 'BBB', model: 'gemini-3.5-flash', source: 'Manual Selection' });
  });

  it('clears a stale selection and falls back to the newest key', async () => {
    m.store = [key('1', 'AAA', 'Old', '2026-01-01'), key('2', 'BBB', 'New', '2026-02-01')];
    localStorage.setItem('manual_active_key_id', 'gone');
    expect(await AKM.getActiveProvider()).toEqual({ id: '2', key: 'BBB', model: 'gemini-3.8-flash', source: 'New' });
    expect(AKM.getActiveKeyId()).toBe('2');
    expect(m.triggerActiveApiKeyChanged).toHaveBeenCalledTimes(1);
  });

  it('uses the .env key when no saved keys exist', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', ' ENVKEY ');
    expect(await AKM.getActiveProvider()).toEqual({ id: 'env', key: 'ENVKEY', model: 'gemini-3.8-flash', source: 'Environment (.env)' });
  });

  it('asks the local server when enabled', async () => {
    m.localServer.value = true;
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ key: ' SRV ' }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await AKM.getActiveProvider()).toEqual({ id: 'local_server', key: 'SRV', model: 'gemini-3.8-flash', source: 'Server Master Key' });
    expect(fetchMock).toHaveBeenCalledWith('http://local/get_api_key.php');
  });

  it('returns null when nothing is configured', async () => {
    expect(await AKM.getActiveProvider()).toBeNull();
  });
});

describe('getFallbackProviders', () => {
  it('lists other saved keys newest first, then .env, skipping duplicates', async () => {
    vi.stubEnv('VITE_API_KEY_1', 'ENV');
    m.store = [
      key('1', 'AAA', 'A', '2026-01-01'), key('2', 'BBB ', '', '2026-03-01'),
      key('3', 'AAA', 'Dup', '2026-02-01'), key('4', 'FAILED', 'F', '2026-04-01'),
    ];
    expect(await AKM.getFallbackProviders(' FAILED ')).toEqual([
      { id: '2', key: 'BBB', source: 'Saved Key' },
      { id: '3', key: 'AAA', source: 'Dup' },
      { id: 'env', key: 'ENV', source: 'Environment (.env)' },
    ]);
  });
});

describe('key store', () => {
  it('adds, activates, lists and deletes keys', async () => {
    const k = await AKM.addUserApiKey(' NEWKEY ', ' Mine ');
    expect(k).toMatchObject({ key: 'NEWKEY', label: 'Mine' });
    expect(AKM.getActiveKeyId()).toBe(k.id);
    m.store.push(key('0', 'OLD', 'Old', '2020-01-01'));
    expect((await AKM.getAllApiKeys()).map(x => x.id)).toEqual([k.id, '0']);
    await AKM.deleteApiKey(k.id);
    expect(AKM.getActiveKeyId()).toBeNull();
    expect(m.triggerActiveApiKeyChanged).toHaveBeenCalledTimes(2);
    await AKM.deleteApiKey('0');
    expect(m.triggerActiveApiKeyChanged).toHaveBeenCalledTimes(2);
  });

  it('labels keys without a name by time', async () => {
    const k = await AKM.addUserApiKey('X', '  ');
    expect(k.label.startsWith('Key ')).toBe(true);
  });
});

describe('call stats', () => {
  it('counts finished features without logging them as requests', async () => {
    expect(await AKM.getTotalCalls()).toBe(0);
    expect(await AKM.incrementTotalCalls('Transcription', 'gemini-3.8-flash', 'Primary', 12)).toBe(1);
    expect(await AKM.getTotalCalls()).toBe(1);
    expect(await AKM.getApiCallLogs()).toEqual([]);
    expect(m.triggerApiCallLogged).toHaveBeenCalledTimes(1);
  });

  it('logs each request with a unique id and keeps the last 2000', async () => {
    logApiCall({ status: 'success', model: 'gemini-3.8-flash', keyTail: 'AAAA', promptTokens: 12, tokens: 20 });
    logApiCall({ status: 'error', model: 'gemini-3.8-flash', rateLimited: true });
    const logs = await AKM.getApiCallLogs();
    expect(logs.map(l => [l.status, l.promptTokens, l.rateLimited])).toEqual([['success', 12, undefined], ['error', undefined, true]]);
    expect(logs[0].id).not.toBe(logs[1].id);

    localStorage.setItem('api_call_logs', JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ id: String(i) }))));
    logApiCall({ status: 'success', model: 'm' });
    const capped = await AKM.getApiCallLogs();
    expect(capped).toHaveLength(2000);
    expect(capped[0].id).toBe('1');
    expect(capped[1999]).toMatchObject({ model: 'm', status: 'success' });
  });

  it('returns empty logs on corrupt storage', async () => {
    localStorage.setItem('api_call_logs', '{bad');
    expect(await AKM.getApiCallLogs()).toEqual([]);
  });
});
