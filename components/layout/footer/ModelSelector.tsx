import React from 'react';
import { getModelDefinition } from '../../../services/ApiKeyManager.ts';
import { useModelSelector } from './useModelSelector';
import { ModelCategoryList } from './ModelCategoryList';
import { ModelInfoTooltip } from './ModelInfoTooltip';
import { uiText } from '../../../utils/uiText';
import { useThemeStore } from '../../../hooks/useThemeStore';

interface Props {
  activeModelName: string;
  isAiLoading: boolean;
  onKeyUpdate?: () => void;
}

// Footer model badge with categorized dropdown, Speed Boost toggle and reset bar
export const ModelSelector = ({ activeModelName, isAiLoading, onKeyUpdate }: Props) => {
  const appLang = useThemeStore(state => state.appLang);
  const selector = useModelSelector(onKeyUpdate);
  const {
    modelSelectRef, showModelSelect, setShowModelSelect, hoveredModel, setHoveredModel,
    speedOpt, resetNotice, handleToggleSpeedOpt, handleResetToDefault,
  } = selector;
  const currentModelDef = getModelDefinition(activeModelName);

  return (
        <div
          ref={modelSelectRef}
          className="flex items-center gap-3 group relative px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer hover:bg-white/5"
          onClick={() => setShowModelSelect(!showModelSelect)}
        >
           <div className="relative">
             <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isAiLoading ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,1)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}></div>
             {isAiLoading && (
               <>
                 <div className="absolute inset-0 w-2 h-2 rounded-full bg-rose-500 animate-ping opacity-75"></div>
                 <div className="absolute -inset-1 border border-rose-500/50 rounded-full animate-[spin_3s_linear_infinite]"></div>
               </>
             )}
           </div>

           <div className="flex flex-col">
              <span className={`text-[10px] font-black tracking-widest bn:tracking-normal transition-all duration-300 ${isAiLoading ? 'text-rose-400' : 'text-amber-400/50'}`}>
                {isAiLoading ? 'NEURAL ENGINE PROCESSING...' : <><span lang="bn" className="bn:tracking-normal">{currentModelDef.categoryLabelBn}</span>{` • ${speedOpt ? 'FAST OPT' : 'CLASSIC'}`}</>}
              </span>
              <span className={`text-[10px] font-black uppercase transition-all duration-500 flex items-center gap-1.5 ${isAiLoading ? 'text-white translate-x-1' : 'text-amber-400/90'}`}>
                {isAiLoading ? 'ANALYZING:' : 'MODEL:'} <span className={isAiLoading ? 'text-rose-400' : ''}>{currentModelDef.label}</span>
              </span>
           </div>

           {/* Categorized Model Dropdown + Bengali Info Tooltip Panel */}
           <div
             onClick={(e) => e.stopPropagation()}
             className={`absolute bottom-[130%] left-0 mb-2 w-[380px] md:w-[430px] bg-slate-900/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-visible transition-all duration-200 origin-bottom-left cursor-default ${showModelSelect ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
           >
             {/* Header */}
             <div className="p-3.5 border-b border-white/10 bg-slate-950/70 rounded-t-2xl flex items-center justify-between gap-2">
               <div>
                 <span className="block text-[11px] text-white font-black tracking-wider bn:tracking-normal">
                   {uiText(appLang, 'modelSelectorTitle')}
                 </span>
                 <span className="block text-[10px] text-slate-400 font-medium normal-case tracking-normal mt-0.5">
                   {uiText(appLang, 'modelHintBefore')} <b className="text-indigo-400">(i)</b> {uiText(appLang, 'modelHintAfter')}
                 </span>
               </div>
               <button
                 type="button"
                 onClick={handleToggleSpeedOpt}
                 title={uiText(appLang, 'toggleSpeedOptTitle')}
                 className={`px-2.5 py-1 min-h-6 rounded-lg text-[10px] font-black tracking-wider bn:tracking-normal uppercase border transition-all cursor-pointer shrink-0 ${
                   speedOpt
                     ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                     : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
                 }`}
               >
                 {speedOpt ? uiText(appLang, 'speedBoostOn') : uiText(appLang, 'speedBoostOff')}
               </button>
             </div>

             {/* Categorized Groups */}
             <ModelCategoryList activeModelName={activeModelName} selector={selector} />

             {/* Safe Rollback / Reset to Previous Default Footer Bar */}
             <div className="p-2.5 border-t border-white/10 bg-slate-950/90 rounded-b-2xl flex items-center justify-between gap-2">
               <span className="text-[10px] text-slate-400 normal-case tracking-normal font-medium">
                 {resetNotice
                   ? uiText(appLang, 'resetDone')
                   : uiText(appLang, 'resetHint')}
               </span>
               <button
                 type="button"
                 onClick={handleResetToDefault}
                 className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-black normal-case tracking-normal transition-all cursor-pointer shrink-0"
               >
                 {uiText(appLang, 'resetToPrevious')}
               </button>
             </div>

             {hoveredModel && (
               <ModelInfoTooltip
                 model={hoveredModel}
                 onMouseEnter={() => setHoveredModel(hoveredModel)}
                 onMouseLeave={() => setHoveredModel(null)}
               />
             )}
           </div>
        </div>
  );
};
