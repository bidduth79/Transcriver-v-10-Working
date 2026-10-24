import React from 'react';
import type { AIModelDefinition } from '../../../services/ApiKeyManager.ts';

interface Props {
  model: AIModelDefinition;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Floating Bengali instruction card shown when hovering a model's (i) button
export const ModelInfoTooltip = ({ model, onMouseEnter, onMouseLeave }: Props) => (
               <div
                 lang="bn"
                 onMouseEnter={onMouseEnter}
                 onMouseLeave={onMouseLeave}
                 className="absolute bottom-4 left-full ml-3 w-80 bg-slate-900/98 backdrop-blur-2xl border border-indigo-500/40 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-[80] text-left normal-case tracking-normal pointer-events-auto"
               >
                 <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
                   <div>
                     <span className="text-xs font-black text-white block">{model.label}</span>
                     <span className="text-[10px] font-bold text-indigo-400">{model.categoryLabelBn} • {model.speedBadgeBn}</span>
                   </div>
                   <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-serif italic font-black">
                     i
                   </span>
                 </div>

                 <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-200">
                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-indigo-300 font-black block text-[10px] mb-0.5">⚙️ কীভাবে কাজ করে:</span>
                     <p className="text-slate-300 font-normal">{model.infoBn.howItWorks}</p>
                   </div>

                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-emerald-300 font-black block text-[10px] mb-0.5">⏱️ গতি ও সময়:</span>
                     <p className="text-slate-300 font-normal">{model.infoBn.speedAndTime}</p>
                   </div>

                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-amber-300 font-black block text-[10px] mb-0.5">🎯 কখন ব্যবহার করবেন:</span>
                     <p className="text-slate-300 font-normal">{model.infoBn.bestFor}</p>
                   </div>

                   <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 px-1">
                     <span>📊 কোটা তথ্য:</span>
                     <span className="text-slate-200 font-bold">{model.infoBn.quotaInfo}</span>
                   </div>
                 </div>
               </div>
);
