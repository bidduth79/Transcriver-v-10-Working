import React from 'react';
import { RefreshCw } from 'lucide-react';
import { KeyQuotaLine } from './KeyQuotaLine';
import { useEnvKeySettings } from './useEnvKeySettings';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface Props {
  activeKeyId: string | null;
  isDark: boolean;
  appLang: string;
  addToast: (m: string, t: ToastType) => void;
  onSelect: (id: string) => void;
}

// Keys from .env, kept on the server and used after the browser's keys; only their last four characters show
export const EnvKeyList = ({ activeKeyId, isDark, appLang, addToast, onSelect }: Props) => {
  const { envKeys, busyId, reload, test } = useEnvKeySettings(appLang, addToast);

  return (
    <div className={`p-4 rounded-3xl border shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-60">{uiText(appLang, 'envKeysTitle')}</h3>
        <button
          type="button"
          onClick={reload}
          disabled={busyId !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors disabled:opacity-50 ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-white'}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busyId === 'reload' ? 'animate-spin' : ''}`} />
          {uiText(appLang, 'envKeysReload')}
        </button>
      </div>
      <p className="text-[11px] opacity-50 mb-3">{uiText(appLang, 'envKeysHint')}</p>

      {envKeys.length === 0 ? (
        <p className="text-xs font-bold opacity-40 py-2">{uiText(appLang, 'envKeysEmpty')}</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {envKeys.map(k => {
            const isActive = activeKeyId === k.id;
            return (
              <div
                key={k.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isActive ? (isDark ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelect(k.id)}
                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer ${isActive ? 'border-indigo-500 bg-indigo-500' : 'border-slate-400 opacity-50 hover:opacity-100'}`}
                  >
                    {isActive && <span className="w-2 h-2 bg-white rounded-full" />}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{k.label}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">.env</span>
                      <span className="text-[10px] font-mono opacity-40">****{k.token.slice(-4)}</span>
                    </div>
                    <KeyQuotaLine tail={k.token.slice(-4)} appLang={appLang} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => test(k)}
                  disabled={busyId !== null}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors disabled:opacity-50 ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'}`}
                >
                  {busyId === k.id ? '…' : uiText(appLang, 'envKeyTest')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
