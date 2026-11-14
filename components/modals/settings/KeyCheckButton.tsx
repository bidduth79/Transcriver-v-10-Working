import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { checkKey } from '../../../services/apiKeys/keyCheck';
import { listEnvKeys } from '../../../services/apiKeys/envKeys';
import { isTranscribeModel } from '../../../hooks/transcription/transcribeModel';
import { DEFAULT_MODEL } from '../../../constants/aiModels';
import { AVAILABLE_MODELS } from '../../../constants/aiModelList';
import type { UserApiKey } from '../../../services/ApiKeyManager';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface Props {
  keyList: UserApiKey[];
  selectedModel: string;
  isDark: boolean;
  appLang: string;
  addToast: (m: string, t: ToastType) => void;
}

// "Test all keys": every saved and .env key is asked one tiny question, one after another (so no per-minute limit
// is hit), and each key's line shows the outcome. A transcribe model takes only audio, so the default model is
// asked instead.
export const KeyCheckButton = ({ keyList, selectedModel, isDark, appLang, addToast }: Props) => {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const model = isTranscribeModel(selectedModel) ? DEFAULT_MODEL : selectedModel;
  const modelLabel = AVAILABLE_MODELS.find(m => m.id === model)?.label ?? model;

  const checkAll = async () => {
    const saved = keyList.map(k => (k.key || '').trim()).filter(Boolean);
    const env = (await listEnvKeys()).map(k => k.token);
    const keys = [...new Set([...saved, ...env])];
    if (keys.length === 0) return addToast(uiText(appLang, 'keyCheckNoKeys'), 'info');
    let working = 0;
    setProgress({ done: 0, total: keys.length });
    for (const [i, key] of keys.entries()) {
      if ((await checkKey(key, model)).status === 'ok') working++;
      setProgress({ done: i + 1, total: keys.length });
    }
    setProgress(null);
    addToast(uiText(appLang, 'keyCheckDone', { ok: working, total: keys.length }), working === keys.length ? 'success' : 'warning');
  };

  return (
    <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-60">{uiText(appLang, 'keyCheckTitle')}</h3>
        <p className="text-[11px] opacity-50 mt-0.5">{uiText(appLang, 'keyCheckHint', { model: modelLabel })}</p>
      </div>
      <button
        type="button"
        onClick={checkAll}
        disabled={progress !== null}
        className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-white'}`}
      >
        <ShieldCheck className={`w-4 h-4 ${progress ? 'animate-pulse' : ''}`} />
        {progress ? uiText(appLang, 'keyCheckRunning', progress) : uiText(appLang, 'keyCheckAll')}
      </button>
    </div>
  );
};
