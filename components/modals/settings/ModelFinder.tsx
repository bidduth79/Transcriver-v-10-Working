import React, { useState } from 'react';
import { Search, Plus, X, FlaskConical } from 'lucide-react';
import { listGoogleModels, type GoogleModel } from '../../../services/apiKeys/modelCatalog';
import { allModels, addCustomModel, removeCustomModel, readCustomModels } from '../../../services/apiKeys/customModels';
import { checkKey, type KeyCheckStatus } from '../../../services/apiKeys/keyCheck';
import { getActiveProvider } from '../../../services/ApiKeyManager';
import { useAppStore } from '../../../hooks/useAppStore';
import type { ToastType } from '../../../hooks/useToast';
import { uiText, type UiTextKey } from '../../../utils/uiText';

interface Props {
  isDark: boolean;
  appLang: string;
  addToast: (m: string, t: ToastType) => void;
}

const TEST_TEXT: Record<KeyCheckStatus, UiTextKey> = {
  ok: 'modelTestOk', noAccess: 'modelTestNoAccess', quotaToday: 'modelTestQuota', rateLimited: 'modelTestRateLimited',
  busy: 'modelTestBusy', invalid: 'modelTestInvalid', error: 'modelTestError',
};

// "Find new models": Google's list for the active key, minus the models the app already offers. A model can be
// tried with one tiny request on that key and added to the model lists; added models can be removed again.
export const ModelFinder = ({ isDark, appLang, addToast }: Props) => {
  useAppStore(state => state.activeApiKeyChanged);
  const [found, setFound] = useState<GoogleModel[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [tests, setTests] = useState<Record<string, KeyCheckStatus | 'running'>>({});
  const added = readCustomModels();
  const offered = new Set(allModels().map(m => m.id));
  const newModels = (found ?? []).filter(m => !offered.has(m.id));

  const find = async () => {
    setSearching(true);
    try {
      const provider = await getActiveProvider();
      if (!provider) return addToast(uiText(appLang, 'modelFinderNoKey'), 'error');
      setFound(await listGoogleModels(provider.key));
    } catch (err) {
      addToast(uiText(appLang, 'modelFinderFailed', { message: (err as Error).message.slice(0, 120) }), 'error');
    } finally {
      setSearching(false);
    }
  };

  const test = async (id: string) => {
    const provider = await getActiveProvider();
    if (!provider) return addToast(uiText(appLang, 'modelFinderNoKey'), 'error');
    setTests(prev => ({ ...prev, [id]: 'running' }));
    const result = await checkKey(provider.key, id);
    setTests(prev => ({ ...prev, [id]: result.status }));
  };

  const add = (model: GoogleModel) => {
    addCustomModel({ id: model.id, label: model.label });
    addToast(uiText(appLang, 'modelFinderAdded', { label: model.label }), 'success');
  };

  const button = `flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-white'}`;
  const row = `flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`;

  return (
    <div className={`p-4 rounded-3xl border flex flex-col gap-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-60">{uiText(appLang, 'modelFinderTitle')}</h3>
          <p className="text-[11px] opacity-50 mt-0.5">{uiText(appLang, 'modelFinderHint')}</p>
        </div>
        <button type="button" onClick={find} disabled={searching} className={`shrink-0 ${button} px-4 py-2 text-xs`}>
          <Search className={`w-4 h-4 ${searching ? 'animate-pulse' : ''}`} />
          {uiText(appLang, searching ? 'modelFinderSearching' : 'modelFinderFind')}
        </button>
      </div>

      {found && newModels.length === 0 && <p className="text-xs font-bold opacity-50">{uiText(appLang, 'modelFinderNone')}</p>}
      {newModels.map(model => {
        const result = tests[model.id];
        return (
          <div key={model.id} className={row}>
            <div className="min-w-0">
              <p className="text-xs font-black truncate">{model.label}</p>
              <p className="text-[10px] font-mono opacity-50 truncate">{model.id}</p>
              {result && result !== 'running' && (
                <p className={`text-[10px] font-bold ${result === 'ok' ? 'text-green-600' : 'text-amber-500'}`}>{uiText(appLang, TEST_TEXT[result])}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => test(model.id)} disabled={result === 'running'} className={button}>
                <FlaskConical className="w-3.5 h-3.5" />{uiText(appLang, 'modelFinderTest')}
              </button>
              <button type="button" onClick={() => add(model)} className={button}>
                <Plus className="w-3.5 h-3.5" />{uiText(appLang, 'modelFinderAdd')}
              </button>
            </div>
          </div>
        );
      })}

      {added.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-black opacity-60">{uiText(appLang, 'modelFinderYours')}</p>
          {added.map(model => (
            <div key={model.id} className={row}>
              <p className="text-xs font-bold truncate">{model.label} <span className="font-mono text-[10px] opacity-50">{model.id}</span></p>
              <button type="button" onClick={() => removeCustomModel(model.id)} className={button}>
                <X className="w-3.5 h-3.5" />{uiText(appLang, 'modelFinderRemove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
