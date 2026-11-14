import React, { useState } from 'react';
import { isSplittingOn, setSplittingOn } from '../../../hooks/transcription/splitPolicy';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface Props {
  isDark: boolean;
  appLang: string;
  addToast: (m: string, t: ToastType) => void;
}

// "Split long audio": on, a long recording goes in parts where that does better (see splitPolicy); off, every
// recording is sent whole. The same card and button as the other switches of this tab.
export const SplitAudioToggle = ({ isDark, appLang, addToast }: Props) => {
  const [on, setOn] = useState(isSplittingOn);

  const toggle = () => {
    const next = !on;
    setSplittingOn(next);
    setOn(next);
    addToast(uiText(appLang, next ? 'splitAudioTurnedOn' : 'splitAudioTurnedOff'), next ? 'success' : 'info');
  };

  return (
    <div className={`p-6 rounded-3xl border flex items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex flex-col gap-1 max-w-md">
        <div className="flex items-center gap-2">
          <span className="text-lg">✂️</span>
          <h3 className="text-sm font-black uppercase tracking-wider bn:tracking-normal">{uiText(appLang, 'splitAudioTitle')}</h3>
        </div>
        <p className="text-xs opacity-60">{uiText(appLang, 'splitAudioHint')}</p>
      </div>
      <button
        onClick={toggle}
        className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest bn:tracking-normal transition-all cursor-pointer shadow-md active:scale-95 ${
          on ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/30' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
        }`}
      >
        {uiText(appLang, on ? 'enabled' : 'disabled')}
      </button>
    </div>
  );
};
