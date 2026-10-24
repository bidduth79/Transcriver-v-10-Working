import React from 'react';
import { UserApiKey } from '../../../services/ApiKeyManager';

interface Props {
  keyList: UserApiKey[];
  activeKeyId: string | null;
  isDark: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

// Saved keys (masked) with radio-style selection and delete buttons
export const ApiKeyList = ({ keyList, activeKeyId, isDark, onSelect, onDelete }: Props) => (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {keyList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <p className="text-sm font-black uppercase tracking-widest">No Keys Found</p>
                        <p className="text-xs mt-2">Add a key above to start</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {keyList.map((k) => (
                            <div 
                                key={k.id} 
                                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                    activeKeyId === k.id 
                                    ? (isDark ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') 
                                    : (isDark ? 'bg-slate-900 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50')
                                }`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div 
                                        onClick={() => onSelect(k.id)}
                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${activeKeyId === k.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-400 opacity-50 hover:opacity-100'}`}
                                    >
                                        {activeKeyId === k.id && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-xs font-black uppercase tracking-wider bn:tracking-normal truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{k.label}</p>
                                            {activeKeyId === k.id && <span className="text-[10px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>}
                                        </div>
                                        <p className="text-[10px] font-mono opacity-40 mt-1 truncate">****{(k.key || '').slice(-8)}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onDelete(k.id)}
                                    className="p-2.5 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                    title="Delete Key"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
);
