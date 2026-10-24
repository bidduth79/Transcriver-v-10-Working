import React from 'react';
import { useShortcutEditor } from './shortcuts/useShortcutEditor';
import { ShortcutCaptureOverlay } from './shortcuts/ShortcutCaptureOverlay';
import { ShortcutCategoryList } from './shortcuts/ShortcutCategoryList';
import type { ActiveColors } from '../../hooks/useAppTheme';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  activeColors: ActiveColors;
  appLang: 'bn' | 'en';
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose, isDark, activeColors }) => {
  const editor = useShortcutEditor(isOpen);
  const { activeTab, setActiveTab, searchTerm, setSearchTerm, editingId, setEditingId, handleResetAll, handleKeyDown } = editor;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-4xl h-[85vh] rounded-[2.5rem] border shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 group">
            <div className={`w-12 h-12 ${activeColors.primary} rounded-2xl flex items-center justify-center shadow-lg rotate-3 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12`}>
              <svg className="w-6 h-6 text-white transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight font-stylish-bn transition-colors group-hover:text-white/90">Keyboard Shortcuts</h2>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">POWER USER CONTROLS</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/10 group">
             <svg className="w-6 h-6 transition-transform group-hover:scale-110 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs & Search */}
        <div className={`px-8 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
           <div className="flex gap-4">
              <button onClick={() => setActiveTab('view')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'view' ? `${activeColors.primary} text-white shadow-lg` : 'hover:bg-black/5 opacity-60 hover:opacity-100'}`}>Cheat Sheet</button>
              <button onClick={() => setActiveTab('edit')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'edit' ? `${activeColors.primary} text-white shadow-lg` : 'hover:bg-black/5 opacity-60 hover:opacity-100'}`}>Customize</button>
           </div>
           
           <div className="flex items-center gap-4 flex-1 justify-end">
              {activeTab === 'edit' && (
                <button onClick={handleResetAll} className="text-xs font-bold text-red-500 hover:underline uppercase tracking-wider">Reset Defaults</button>
              )}
              <div className={`relative flex items-center bg-white border rounded-xl px-3 py-2 w-64 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-200'}`}>
                 <svg className="w-4 h-4 opacity-50 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                 <input 
                   type="text" 
                   placeholder="Search shortcuts..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="bg-transparent border-none outline-none text-xs font-bold w-full"
                 />
              </div>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
           {editingId && <ShortcutCaptureOverlay onKeyDown={handleKeyDown} onCancel={() => setEditingId(null)} />}

           <ShortcutCategoryList editor={editor} isDark={isDark} />
        </div>
      </div>
    </div>
  );
};
