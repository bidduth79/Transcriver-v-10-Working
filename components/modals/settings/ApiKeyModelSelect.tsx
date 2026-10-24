import React from 'react';
import { Cpu } from 'lucide-react';
import { AVAILABLE_MODELS, MODEL_CATEGORY_GROUPS } from '../../../services/ApiKeyManager';
import { uiText } from '../../../utils/uiText';

interface Props {
  isDark: boolean;
  appLang: 'bn' | 'en';
  selectedModel: string;
  onChange: (modelId: string) => void;
}

// Model dropdown grouped by speed category
export const ApiKeyModelSelect = ({ isDark, appLang, selectedModel, onChange }: Props) => (
            <div className={`p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-80">
                            {uiText(appLang, 'activeAiModel')}
                        </h3>
                        <p className="text-[11px] opacity-50 mt-0.5">
                            {uiText(appLang, 'selectGeminiModelForTranscriptionAnalysis')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedModel}
                        onChange={(e) => onChange(e.target.value)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border outline-none cursor-pointer focus:ring-2 ${
                            isDark ? 'bg-slate-800 border-slate-600 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-500/20'
                        }`}
                    >
                        {MODEL_CATEGORY_GROUPS.map(group => (
                            <optgroup key={group.id} label={appLang === 'bn' ? group.titleBn : group.titleEn}>
                                {AVAILABLE_MODELS.filter(m => m.category === group.id).map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.label} — {m.speedBadgeBn} {m.badge ? `(${m.badge})` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            </div>
);
