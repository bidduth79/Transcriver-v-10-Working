import React from 'react';
import { AVAILABLE_MODELS, MODEL_CATEGORY_GROUPS, DEFAULT_MODEL } from '../../../services/ApiKeyManager.ts';
import type { ModelSelectorState } from './useModelSelector';

interface Props {
  activeModelName: string;
  selector: ModelSelectorState;
}

// Model list grouped by speed category, each row with a Bengali info (i) button
export const ModelCategoryList = ({ activeModelName, selector }: Props) => {
  const { hoveredModel, setHoveredModel, handleModelSelect } = selector;
  return (
             <div className="p-2.5 max-h-[370px] overflow-y-auto custom-scrollbar space-y-3">
               {MODEL_CATEGORY_GROUPS.map(group => {
                 const groupModels = AVAILABLE_MODELS.filter(m => m.category === group.id);
                 return (
                   <div key={group.id} className="bg-slate-950/50 border border-white/5 rounded-xl p-2">
                     <div className="px-2 py-1 mb-1 border-b border-white/5">
                       <div className={`text-[10px] font-black tracking-wide normal-case ${group.accentClass}`}>
                         {group.titleBn}
                       </div>
                       <div className="text-[9px] text-slate-400 font-medium normal-case tracking-normal">
                         {group.subtitleBn}
                       </div>
                     </div>

                     <div className="flex flex-col gap-1">
                       {groupModels.map(m => {
                         const isSelected = activeModelName === m.id;
                         const isHovered = hoveredModel?.id === m.id;
                         return (
                           <div
                             key={m.id}
                             onClick={() => handleModelSelect(m.id)}
                             className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                               isSelected
                                 ? 'bg-indigo-500/25 border border-indigo-500/40 text-white shadow-sm'
                                 : 'hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                             }`}
                           >
                             <div className="flex items-center gap-2 min-w-0">
                               <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.9)]' : 'bg-slate-600'}`}></div>
                               <div className="truncate">
                                 <span className="text-[11px] font-bold tracking-wider block truncate">{m.label}</span>
                                 <span className="text-[9px] text-slate-400 normal-case tracking-normal font-medium">
                                   গতি: {m.speedBadgeBn} {m.id === DEFAULT_MODEL ? '• (ডিফল্ট)' : ''}
                                 </span>
                               </div>
                             </div>

                             <div className="flex items-center gap-2 shrink-0">
                               {m.badge && (
                                 <span className={`text-[8px] px-2 py-0.5 rounded-md font-black tracking-wider border ${group.badgeClass}`}>
                                   {m.badge}
                                 </span>
                               )}

                               {/* Info (i) Button for Bengali Hover Instructions */}
                               <button
                                 type="button"
                                 onMouseEnter={() => setHoveredModel(m)}
                                 onMouseLeave={() => setHoveredModel(prev => (prev?.id === m.id ? null : prev))}
                                 onFocus={() => setHoveredModel(m)}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setHoveredModel(prev => (prev?.id === m.id ? null : m));
                                 }}
                                 aria-label={`${m.label} বাংলা নির্দেশনা`}
                                 className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-serif italic font-black transition-all border cursor-help ${
                                   isHovered
                                     ? 'bg-indigo-500 text-white border-indigo-400 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.8)]'
                                     : 'bg-white/10 text-indigo-300 border-white/15 hover:bg-indigo-500 hover:text-white'
                                 }`}
                               >
                                 i
                               </button>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })}
             </div>
  );
};
