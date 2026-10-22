import React from 'react';

interface Props {
  isDark: boolean;
  histSentimentFilter: string;
  setHistSentimentFilter: (v: string) => void;
  onClose: () => void;
}

export const HistorySentimentPicker = ({ isDark, histSentimentFilter, setHistSentimentFilter, onClose }: Props) => {
  const select = (value: string) => { setHistSentimentFilter(value); onClose(); };
  return (
          <div className={`absolute top-[76px] right-[36px] w-[140px] overflow-hidden rounded-2xl shadow-2xl border z-[9999] flex flex-col ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} `} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col p-1.5 gap-1">
              <button onClick={() => select('All')} className={`px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors ${histSentimentFilter === 'All' ? (isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}`}>All</button>
              <button onClick={() => select('Positive')} className={`px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors ${histSentimentFilter === 'Positive' ? 'bg-green-500/20 text-green-500' : (isDark ? 'hover:bg-slate-800 text-green-400' : 'hover:bg-slate-100 text-green-600')}`}>Positive</button>
              <button onClick={() => select('Negative')} className={`px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors ${histSentimentFilter === 'Negative' ? 'bg-red-500/20 text-red-500' : (isDark ? 'hover:bg-slate-800 text-red-400' : 'hover:bg-slate-100 text-red-600')}`}>Negative</button>
              <button onClick={() => select('Neutral')} className={`px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors ${histSentimentFilter === 'Neutral' ? 'bg-yellow-500/20 text-yellow-500' : (isDark ? 'hover:bg-slate-800 text-yellow-400' : 'hover:bg-slate-100 text-yellow-600')}`}>Neutral</button>
            </div>
          </div>
  );
};
