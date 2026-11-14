import React, { useState } from 'react';
import { X, History } from 'lucide-react';
import { knownNameList, addKnownName, removeKnownName, learnNamesFromHistory, MAX_PROMPT_NAMES, MIN_TRANSCRIPTS } from '../../../services/knownNames';
import { forEachHistoryRecord } from '../../../services/historyRecords';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface Props {
  isDark: boolean;
  appLang: string;
  addToast: (m: string, t: ToastType) => void;
}

// The name list: the names Gemini is given with their spelling. The user adds or removes names; the rest are
// learned from the speakers of saved transcripts, once a name came up in several of them.
export const KnownNamesCard = ({ isDark, appLang, addToast }: Props) => {
  const [names, setNames] = useState(knownNameList);
  const [input, setInput] = useState('');
  const [learning, setLearning] = useState(false);
  const refresh = () => setNames(knownNameList());

  const add = () => {
    for (const name of input.split(',')) addKnownName(name);
    setInput('');
    refresh();
  };

  const learn = async () => {
    setLearning(true);
    try {
      const count = await learnNamesFromHistory(visit => forEachHistoryRecord(item => visit(item.transcript || '')));
      refresh();
      addToast(uiText(appLang, 'knownNamesLearned', { count }), 'success');
    } catch {
      addToast(uiText(appLang, 'knownNamesLearnFailed'), 'error');
    } finally {
      setLearning(false);
    }
  };

  const field = `flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border outline-none focus:ring-2 ${isDark ? 'bg-slate-800 border-slate-600 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-500/20'}`;
  const button = `shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-white'}`;

  return (
    <div className={`p-6 rounded-3xl border flex flex-col gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-60">{uiText(appLang, 'knownNamesTitle')}</h3>
          <p className="text-[11px] opacity-50 mt-0.5">{uiText(appLang, 'knownNamesHint', { min: MIN_TRANSCRIPTS, max: MAX_PROMPT_NAMES })}</p>
        </div>
        <button type="button" onClick={learn} disabled={learning} className={button}>
          <History className={`w-4 h-4 ${learning ? 'animate-spin' : ''}`} />
          {uiText(appLang, learning ? 'knownNamesLearning' : 'knownNamesLearn')}
        </button>
      </div>
      <div className="flex gap-3">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={uiText(appLang, 'knownNamesPlaceholder')} className={field} />
        <button type="button" onClick={add} disabled={!input.trim()} className={button}>{uiText(appLang, 'add')}</button>
      </div>
      {names.length === 0 ? (
        <p className="text-xs font-bold opacity-40">{uiText(appLang, 'knownNamesEmpty')}</p>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
          {names.map(({ name, count, added }) => (
            <span key={name} title={added ? uiText(appLang, 'knownNamesYours') : uiText(appLang, 'knownNamesCount', { count })}
              className={`flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs font-bold border ${added ? 'border-indigo-500/50 bg-indigo-500/10' : (isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-white')}`}>
              {name}
              <button type="button" onClick={() => { removeKnownName(name); refresh(); }} className="p-0.5 rounded-full opacity-50 hover:opacity-100 hover:bg-red-500 hover:text-white" aria-label={uiText(appLang, 'delete')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
