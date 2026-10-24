import React, { useState, useEffect } from 'react';
import { isMicrophoneEnabled, setMicrophoneEnabled } from '../../../hooks/useAudioRecorder';
import { isLocalServerEnabled, setLocalServerEnabled } from '../../../utils/config';
import type { ActiveColors } from '../../../hooks/useAppTheme';
import type { ToastType } from '../../../hooks/useToast';
import { uiText } from '../../../utils/uiText';

interface SettingsSystemProps {
    isDark: boolean;
    activeColors: ActiveColors;
    appLang: 'bn' | 'en';
    addToast: (m: string, t: ToastType) => void;
}

export const SettingsSystem: React.FC<SettingsSystemProps> = ({ isDark, activeColors, appLang, addToast }) => {
    const [downloadPath, setDownloadPath] = useState('');
    const [micEnabled, setMicEnabled] = useState(isMicrophoneEnabled());
    const [xamppEnabled, setXamppEnabled] = useState(isLocalServerEnabled());

    useEffect(() => {
        setDownloadPath(localStorage.getItem('customDownloadPath') || '');
    }, []);

    const handleToggleMicrophone = () => {
        const nextState = !micEnabled;
        setMicrophoneEnabled(nextState);
        setMicEnabled(nextState);
        addToast(
            nextState 
                ? (uiText(appLang, 'microphoneOptionEnabled'))
                : (uiText(appLang, 'microphoneOptionDisabled')),
            nextState ? 'success' : 'info'
        );
    };

    const handleToggleXampp = () => {
        const nextState = !xamppEnabled;
        setLocalServerEnabled(nextState);
        setXamppEnabled(nextState);
        addToast(
            nextState 
                ? (uiText(appLang, 'localXamppServerEnabled'))
                : (uiText(appLang, 'localXamppServerDisabled')),
            nextState ? 'success' : 'info'
        );
    };

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-2">
            {/* 1. Microphone Toggle */}
            <div className={`p-6 rounded-3xl border flex items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col gap-1 max-w-md">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎙️</span>
                        <h3 className="text-sm font-black uppercase tracking-wider">
                            {uiText(appLang, 'liveMicrophoneRecording')}
                        </h3>
                    </div>
                    <p className="text-xs opacity-60">
                        {uiText(appLang, 'showOrHideTheLiveMicrophone')}
                    </p>
                </div>
                <button
                    onClick={handleToggleMicrophone}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95 ${
                        micEnabled 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/30' 
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                >
                    {micEnabled 
                        ? (uiText(appLang, 'enabled')) 
                        : (uiText(appLang, 'disabled'))}
                </button>
            </div>

            {/* 2. Local XAMPP Server Toggle */}
            <div className={`p-6 rounded-3xl border flex items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col gap-1 max-w-md">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🖥️</span>
                        <h3 className="text-sm font-black uppercase tracking-wider">
                            {uiText(appLang, 'localXamppServer12700')}
                        </h3>
                    </div>
                    <p className="text-xs opacity-60">
                        {uiText(appLang, 'enableOrDisableSyncWithLocal')}
                    </p>
                </div>
                <button
                    onClick={handleToggleXampp}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95 ${
                        xamppEnabled 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/30' 
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                >
                    {xamppEnabled 
                        ? (uiText(appLang, 'enabled')) 
                        : (uiText(appLang, 'disabled'))}
                </button>
            </div>

            {/* 3. Download Path */}
            <div className={`p-6 rounded-3xl border flex flex-col gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-xs font-black uppercase tracking-widest opacity-60">
                    {uiText(appLang, 'downloadPathFolderLocation')}
                </h3>
                <p className="text-[10px] opacity-60">
                    {uiText(appLang, 'ifLeftEmptyFilesWillBe')}
                </p>
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        placeholder={uiText(appLang, 'eGEMydownloads')}
                        value={downloadPath}
                        onChange={e => setDownloadPath(e.target.value)}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border outline-none focus:ring-2 ${isDark ? 'bg-slate-800 border-slate-600 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-300 text-slate-800 focus:ring-indigo-500/20'}`}
                    />
                    <button 
                        onClick={() => {
                            localStorage.setItem('customDownloadPath', downloadPath.trim());
                            addToast(uiText(appLang, 'downloadPathSaved'), 'success');
                        }}
                        className={`px-6 py-3 ${activeColors.primary} text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer`}
                    >
                        {uiText(appLang, 'save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
