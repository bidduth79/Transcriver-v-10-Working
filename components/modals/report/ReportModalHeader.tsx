import React from 'react';

interface Props {
  activeColors: any;
  viewMode: 'generate' | 'history';
  historyCount: number;
  onSelectView: (mode: 'generate' | 'history') => void;
  setIsMinimized: (v: boolean) => void;
  isMaximized: boolean;
  setIsMaximized: (v: boolean) => void;
  onClose: () => void;
}

// Title, generate/history tabs and window buttons
export const ReportModalHeader = ({ activeColors, viewMode, historyCount, onSelectView, setIsMinimized, isMaximized, setIsMaximized, onClose }: Props) => (
        <header className="px-12 py-10 bg-slate-950 text-white flex items-center justify-between shrink-0 cursor-move">
          <div className="flex items-center gap-6 group">
            <div className={`w-14 h-14 ${activeColors.primary} rounded-2xl flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
              <svg className="w-8 h-8 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight font-stylish-bn leading-none transition-colors group-hover:text-white/90">রিপোর্ট জেনারেটর</h2>
              <div className="flex gap-6 mt-4">
                <button onClick={() => onSelectView('generate')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${viewMode === 'generate' ? 'border-white' : 'border-transparent opacity-40 hover:opacity-100'}`}>তৈরি করুন</button>
                <button onClick={() => onSelectView('history')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${viewMode === 'history' ? 'border-white' : 'border-transparent opacity-40 hover:opacity-100'}`}>হিস্টোরি ({historyCount})</button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMinimized(true)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5 group">
                <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4"/></svg>
            </button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5 group">
                <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4"/></svg>
            </button>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5 group">
                <svg className="w-6 h-6 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>
);
