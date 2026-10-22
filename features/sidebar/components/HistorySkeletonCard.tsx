import React from 'react';

// Placeholder card shown while history items are loading
export const HistorySkeletonCard = ({ isDark }: { isDark: boolean }) => (
  <div className={`p-4 rounded-2xl border animate-pulse ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white/60 border-slate-200/60'}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`h-4 rounded w-2/3 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
      <div className={`h-3 rounded w-8 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
    </div>
    <div className={`h-3 rounded w-1/3 mb-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
    <div className="flex gap-2">
      <div className={`h-6 rounded-full w-16 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
      <div className={`h-6 rounded-full w-12 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
    </div>
  </div>
);
