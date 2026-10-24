import React from 'react';

interface Props {
  onTxt: () => void;
  onWord: () => void;
  onSrt: () => void;
  onPdf: () => void;
  showKeywordToggle: boolean;
  includeKeywords: boolean;
  setIncludeKeywords: (v: boolean) => void;
}

// Dropdown with the four export formats and the keyword-highlight toggle
export const DownloadMenuPanel = ({ onTxt, onWord, onSrt, onPdf, showKeywordToggle, includeKeywords, setIncludeKeywords }: Props) => (
        <div className="absolute right-0 top-full mt-3 w-64 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4 duration-300 ring-1 ring-white/5">
          <div className="p-3 space-y-1.5">
            <button onClick={onTxt} className="w-full flex items-center gap-4 px-5 py-4 text-white hover:bg-white/10 transition-all rounded-2xl group text-left active:scale-[0.97]">
              <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black tracking-widest uppercase">Notepad</span>
                <span className="text-[10px] text-white/40 font-bold uppercase">Plain Text File</span>
              </div>
            </button>

            <button onClick={onWord} className="w-full flex items-center gap-4 px-5 py-4 text-white hover:bg-white/10 transition-all rounded-2xl group text-left active:scale-[0.97]">
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black tracking-widest uppercase">Word Document</span>
                <span className="text-[10px] text-white/40 font-bold uppercase">Editable MS Word</span>
              </div>
            </button>

            <button onClick={onSrt} className="w-full flex items-center gap-4 px-5 py-4 text-white hover:bg-white/10 transition-all rounded-2xl group text-left active:scale-[0.97]">
              <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black tracking-widest uppercase">Subtitle SRT</span>
                <span className="text-[10px] text-white/40 font-bold uppercase">Captions with Time</span>
              </div>
            </button>

            <button onClick={onPdf} className="w-full flex items-center gap-4 px-5 py-4 text-white hover:bg-white/10 transition-all rounded-2xl group text-left active:scale-[0.97]">
              <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black tracking-widest uppercase">PDF Document</span>
                <span className="text-[10px] text-white/40 font-bold uppercase">Ready to Print</span>
              </div>
            </button>

            {showKeywordToggle && (
              <div className="mt-2 pt-2 border-t border-white/10 px-4 pb-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer appearance-none w-4 h-4 rounded border border-white/30 checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer"
                      checked={includeKeywords}
                      onChange={(e) => setIncludeKeywords(e.target.checked)}
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 peer-checked:scale-100 scale-50 transition-all pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-white/70 group-hover:text-white transition-colors">
                    Highlight Keywords in PDF & Word
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
);
