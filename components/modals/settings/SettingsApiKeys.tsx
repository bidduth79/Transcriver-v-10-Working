import React from 'react';
import { ConfirmModal } from '../ConfirmModal';
import { useApiKeySettings } from './useApiKeySettings';
import { ApiKeyModelSelect } from './ApiKeyModelSelect';
import { ApiKeyList } from './ApiKeyList';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface SettingsApiKeysProps {
    isDark: boolean;
    activeColors: ActiveColors;
    appLang: 'bn' | 'en';
    addToast: (m: string, t: ToastType) => void;
}

export const SettingsApiKeys: React.FC<SettingsApiKeysProps> = ({ isDark, activeColors, appLang, addToast }) => {
    const {
        keyList, activeKeyId, selectedModel, newKeyInput, setNewKeyInput, newKeyLabel, setNewKeyLabel,
        isAddingKey, keyToDelete, setKeyToDelete, handleAddKey, handleSelectKey, handleDeleteKey, confirmDelete, handleModelChange,
    } = useApiKeySettings(appLang, addToast);

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* AI Model Selection */}
            <ApiKeyModelSelect isDark={isDark} appLang={appLang} selectedModel={selectedModel} onChange={handleModelChange} />

            {/* Input Area */}
            <div className={`p-6 rounded-3xl border flex flex-col gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-xs font-black uppercase tracking-widest bn:tracking-normal opacity-60">{uiText(appLang, 'addNewKey')}</h3>
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        placeholder="Enter Gemini API Key (starts with AIza...)" 
                        value={newKeyInput}
                        onChange={e => setNewKeyInput(e.target.value)}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border outline-none focus:ring-2 ${isDark ? 'bg-slate-800 border-slate-600 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-500/20'}`}
                    />
                    <input 
                        type="text" 
                        placeholder="Label (Optional)" 
                        value={newKeyLabel}
                        onChange={e => setNewKeyLabel(e.target.value)}
                        className={`w-40 px-4 py-3 rounded-xl text-sm font-bold border outline-none focus:ring-2 ${isDark ? 'bg-slate-800 border-slate-600 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-500/20'}`}
                    />
                    <button 
                        onClick={handleAddKey}
                        disabled={isAddingKey || !newKeyInput}
                        className={`px-6 py-3 ${activeColors.primary} text-white rounded-xl font-black uppercase tracking-widest bn:tracking-normal text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50`}
                    >
                        {isAddingKey ? 'ADDING...' : (uiText(appLang, 'add'))}
                    </button>
                </div>
            </div>

            {/* List Area */}
            <ApiKeyList keyList={keyList} activeKeyId={activeKeyId} isDark={isDark} onSelect={handleSelectKey} onDelete={handleDeleteKey} />

            <ConfirmModal
                isOpen={!!keyToDelete}
                onClose={() => setKeyToDelete(null)}
                onConfirm={confirmDelete}
                title={uiText(appLang, 'confirmation')}
                message={uiText(appLang, 'areYouSureYouWantTo')}
                confirmText={uiText(appLang, 'delete')}
                cancelText={uiText(appLang, 'cancel')}
                isDark={isDark}
                activeColors={activeColors}
            />
        </div>
    );
};
