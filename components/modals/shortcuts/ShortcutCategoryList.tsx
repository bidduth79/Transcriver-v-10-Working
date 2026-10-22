import React from 'react';
import { SHORTCUT_CATEGORIES } from '../../../services/ShortcutConfig';
import type { ShortcutEditorState } from './useShortcutEditor';

interface Props {
  editor: ShortcutEditorState;
  isDark: boolean;
}

// Shortcuts grouped by category; customized keys get a ring, edit buttons show on the Customize tab
export const ShortcutCategoryList = ({ editor, isDark }: Props) => {
  const { groupedShortcuts, customMap, activeTab, startEditing } = editor;
  const getDisplayKey = (id: string, defaultKey: string) => customMap[id] || defaultKey;
  return (
           <div className="grid grid-cols-1 gap-8">
              {SHORTCUT_CATEGORIES.map(cat => {
                 const items = groupedShortcuts[cat];
                 if (!items || items.length === 0) return null;

                 return (
                   <div key={cat} className="space-y-4">
                      <div className="flex items-center gap-4">
                         <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                         <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{cat}</span>
                         <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {items.map(item => {
                           const currentKey = getDisplayKey(item.id, item.defaultKeys);
                           const isModified = currentKey !== item.defaultKeys;

                           return (
                             <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between group hover:border-indigo-500/30 transition-all ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                                <div>
                                   <p className={`text-xs font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                                   <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{item.description}</p>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                   <kbd className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border shadow-sm min-w-[80px] text-center ${isDark ? 'bg-slate-800 border-slate-600 text-indigo-300' : 'bg-slate-100 border-slate-200 text-slate-700'} ${isModified ? 'ring-1 ring-indigo-500/50' : ''}`}>
                                      {currentKey}
                                   </kbd>
                                   
                                   {activeTab === 'edit' && (
                                     <button 
                                       onClick={() => startEditing(item.id)}
                                       className="p-2 bg-white/5 hover:bg-indigo-600 hover:text-white rounded-lg transition-all text-slate-400"
                                       title="Edit Shortcut"
                                     >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                     </button>
                                   )}
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
