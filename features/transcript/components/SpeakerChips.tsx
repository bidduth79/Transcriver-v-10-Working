import React, { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { uiText } from '../../../utils/uiText';

// Speakers named at the start of paragraphs ("[01:15] **Name:**"), the most frequent first
export const listSpeakers = (transcript: string) => {
  const counts = new Map<string, number>();
  for (const match of transcript.matchAll(/^(?:\[[^\]\n]+\]\s*)?\*\*\s*([^*\n]+?)\s*:?\s*\*\*/gm)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
};

// A name the model gives when it does not know who is speaking
const isUnnamed = (name: string) => /^speaker\s*\d+$/i.test(name);

interface Props {
  transcript: string;
  isDark: boolean;
  appLang: string;
  onRename: (name: string) => void;
  className?: string;
}

// All speakers of the transcript in one row: a click renames that speaker everywhere
export const SpeakerChips = ({ transcript, isDark, appLang, onRename, className = '' }: Props) => {
  const speakers = useMemo(() => listSpeakers(transcript), [transcript]);
  if (speakers.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className={`font-bold ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{uiText(appLang, 'speakersLabel')}</span>
      {speakers.map(({ name, count }) => (
        <button
          key={name}
          type="button"
          onClick={() => onRename(name)}
          title={uiText(appLang, 'renameSpeakerHint')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold transition-colors ${
            isUnnamed(name)
              ? (isDark ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100')
              : (isDark ? 'border-white/10 bg-white/5 text-indigo-300 hover:bg-white/10' : 'border-slate-200 bg-white text-indigo-700 hover:bg-slate-50')
          }`}
        >
          {name}
          <span className="opacity-60 tabular-nums">({count})</span>
          <Pencil className="w-3 h-3 opacity-70" />
        </button>
      ))}
    </div>
  );
};
