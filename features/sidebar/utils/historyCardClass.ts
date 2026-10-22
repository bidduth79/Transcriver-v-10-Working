interface CardState {
  isPressing: boolean;
  isActive: boolean;
  isDuplicate: boolean;
  isSensitive: boolean;
  isDark: boolean;
}

// Card colors by priority: deleting > loaded > duplicate > sensitive > default
export const getHistoryCardClass = ({ isPressing, isActive, isDuplicate, isSensitive, isDark }: CardState) => {
  let itemClass = "";
  
  if (isPressing) {
      itemClass = isDark
          ? 'bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.25)] scale-[0.98]'
          : 'bg-red-50 border-red-400 shadow-md scale-[0.98]';
  } else if (isActive) {
      // ACTIVE STATE: Light Green as requested
      itemClass = isDark 
          ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
          : 'bg-green-50 border-green-400 shadow-md';
  } else if (isDuplicate) {
      // DUPLICATE STATE: Light Yellow as requested
      itemClass = isDark 
          ? 'bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
          : 'bg-yellow-50 border-yellow-400 shadow-md';
  } else if (isSensitive) {
      // Sensitive State
      itemClass = isDark 
          ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900/20 hover:border-red-500/50' 
          : 'bg-red-50 border-red-100 hover:bg-red-100 hover:border-red-200';
  } else {
      // Default State
      itemClass = isDark 
          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-indigo-400/50' 
          : 'bg-white border-slate-100 hover:bg-indigo-50 hover:border-indigo-200';
  }
  return itemClass;
};
