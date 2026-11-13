import React from 'react';
import { Megaphone, ChevronRight, ChevronDown } from 'lucide-react';
import type { AdRange } from '../../../utils/adBlocks';
import { uiText } from '../../../utils/uiText';

interface Props {
  range: AdRange;
  isOpen: boolean;
  onToggle: () => void;
  isDark: boolean;
  appLang: string;
}

// One folded line for an advertisement or promo block: "Advertisement [15:32–17:10] · Show"
export const AdBlockToggle = ({ range, isOpen, onToggle, isDark, appLang }: Props) => {
  const span = [range.from, range.to].filter(Boolean).join('–').replace(/\]–\[/, '–');
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`my-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-[0.75em] font-bold transition-colors ${isDark ? 'border-white/15 text-white/50 hover:bg-white/5' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
    >
      <Megaphone className="w-3.5 h-3.5 shrink-0" />
      <span>{uiText(appLang, 'adBlockLabel')}</span>
      {span && <span className="font-mono opacity-70">{span}</span>}
      <span className="opacity-70">· {uiText(appLang, isOpen ? 'adBlockHide' : 'adBlockShow')}</span>
      {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
};
