import React, { useState, useEffect } from 'react';
import { syncAllLocalToCloud, checkCloudConnection } from '../../../services/api';
import { isLocalServerEnabled, setLocalServerEnabled } from '../../../utils/config';
import { 
    getFirebaseSyncStats, 
    subscribeFirebaseSyncStats, 
    scheduleGentleFirebasePull,
    FirebaseGentleSyncStats 
} from '../../../services/firebaseThrottledQueue';
import { useAppStore } from '../../../hooks/useAppStore';

interface SettingsSyncProps {
    isDark: boolean;
    activeColors: any;
    appLang: 'bn' | 'en';
    addToast: (m: string, t: any) => void;
}

export const SettingsSync: React.FC<SettingsSyncProps> = ({ isDark, activeColors, appLang, addToast }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState('Idle');
    const [cloudConnection, setCloudConnection] = useState<string>('Checking...');
    const [xamppEnabled, setXamppEnabled] = useState(isLocalServerEnabled());
    const [fbStats, setFbStats] = useState<FirebaseGentleSyncStats>(() => getFirebaseSyncStats());

    useEffect(() => {
        let mounted = true;
        checkCloudConnection().then(res => {
            if(mounted) {
                setCloudConnection(res.status === 'online' ? 'Online & Authenticated' : res.message);
            }
        }).catch(() => {
            if(mounted) setCloudConnection('Connection Check Failed');
        });

        const unsubscribe = subscribeFirebaseSyncStats(() => {
            if (mounted) {
                setFbStats(getFirebaseSyncStats());
            }
        });

        return () => { 
            mounted = false; 
            unsubscribe();
        };
    }, []);

    const handleToggleXampp = () => {
        const nextState = !xamppEnabled;
        setLocalServerEnabled(nextState);
        setXamppEnabled(nextState);
        addToast(
            nextState 
                ? (appLang === 'bn' ? '🖥️ লোকাল জেম্প সার্ভার সিঙ্ক চালু করা হয়েছে' : '🖥️ Local XAMPP Server sync enabled')
                : (appLang === 'bn' ? '🖥️ লোকাল জেম্প সার্ভার সিঙ্ক বন্ধ করা হয়েছে' : '🖥️ Local XAMPP Server sync disabled'),
            nextState ? 'success' : 'info'
        );
    };

    const handleGentleCloudPull = async () => {
        if (fbStats.isPulling || isSyncing) return;
        addToast(appLang === 'bn' ? 'ফায়ারবেইজ থেকে ধীরে ধীরে ডাটা চেক করা হচ্ছে...' : 'Checking Firebase gently...', 'info');
        const res = await scheduleGentleFirebasePull(() => {
            useAppStore.getState().triggerStoreUpdate('studio_history');
        }, true);
        if (res.pulledCount > 0) {
            addToast(appLang === 'bn' ? `ফায়ারবেইজ থেকে ${res.pulledCount}টি নতুন ডাটা যুক্ত হয়েছে!` : `Merged ${res.pulledCount} records from Firebase`, 'success');
        } else {
            addToast(appLang === 'bn' ? `সকল ডাটা আপ-টু-ডেট আছে (ক্লাউডে মোট: ${res.cloudTotal}টি)` : `All records up to date (Cloud total: ${res.cloudTotal})`, 'info');
        }
    };

    const handleStartSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('ধীরে ধীরে মাস্টার সিঙ্ক শুরু হচ্ছে...');
        
        try {
            await syncAllLocalToCloud((msg, pct) => {
                setSyncStatus(msg);
                setSyncProgress(pct);
            });
            useAppStore.getState().triggerStoreUpdate('studio_history');
            addToast(appLang === 'bn' ? 'সকল ডাটাবেইজ সিনক্রোনাইজ সম্পন্ন হয়েছে' : 'All Databases Synced Successfully', 'success');
        } catch (e: any) {
            setSyncStatus('Failed: ' + e.message);
            addToast(appLang === 'bn' ? 'অপারেশন ব্যর্থ হয়েছে' : 'Operation Failed', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto pr-2">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Firebase Status */}
                <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className="text-xs font-black uppercase tracking-widest mb-3 opacity-60">
                        {appLang === 'bn' ? 'ফায়ারবেস ক্লাউড স্ট্যাটাস' : 'Firebase Cloud Status'}
                    </h3>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${cloudConnection.includes('Online') ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}></div>
                        <span className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cloudConnection}</span>
                    </div>
                    <p className="text-[11px] opacity-70 mt-2 font-medium">
                        {fbStats.statusMessageBn}
                    </p>
                </div>

                {/* Local XAMPP Toggle Card */}
                <div className={`p-6 rounded-3xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">
                            {appLang === 'bn' ? 'লোকাল জেম্প সার্ভার (XAMPP)' : 'Local XAMPP Server'}
                        </h3>
                        <p className="text-[10px] opacity-60">
                            {xamppEnabled ? '127.0.0.1/licell_api সক্রিয়' : (appLang === 'bn' ? 'আপতত সম্পূর্ণ বন্ধ (OFF)' : 'Completely Paused')}
                        </p>
                    </div>
                    <button
                        onClick={handleToggleXampp}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95 ${
                            xamppEnabled 
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                    >
                        {xamppEnabled ? '✓ ON' : '✕ OFF'}
                    </button>
                </div>
            </div>

            {/* Gentle Firebase Queue & Pull Info Bar */}
            <div className={`p-5 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4 ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="space-y-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">
                            🛡️ স্মার্ট ব্যাচ-লক ও চাপমুক্ত ফায়ারবেইজ সিঙ্ক (Zero-RAM Queue)
                        </h4>
                        {fbStats.isPausedForProcessing && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase">
                                ⏸️ অডিও প্রসেসিং চলছে (সিঙ্ক লকড)
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] opacity-75">
                        ক্লাউড হিস্টোরি: <b>{fbStats.totalCloudHistoryDocs}টি</b> • নতুন যুক্ত: <b>{fbStats.lastPulledCount}টি</b> • কিউতে অপেক্ষমাণ সেভ: <b>{fbStats.pendingWrites}টি</b>
                        {fbStats.lastSyncTime ? ` • সর্বশেষ সিঙ্ক: ${fbStats.lastSyncTime}` : ''}
                    </p>
                </div>
                <button
                    onClick={handleGentleCloudPull}
                    disabled={fbStats.isPulling || isSyncing || fbStats.isPausedForProcessing}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black tracking-wide transition-all cursor-pointer shrink-0 shadow-md"
                >
                    {fbStats.isPulling ? 'ধীরে ধীরে চেক হচ্ছে...' : '☁️ ফায়ারবেইজ থেকে নতুন ডাটা আনুন'}
                </button>
            </div>

            {/* Sync Action Area */}
            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isSyncing ? 'bg-indigo-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {isSyncing ? (
                        <svg className="w-9 h-9 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    ) : (
                        <svg className="w-9 h-9 text-slate-400 dark:text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    )}
                </div>
                
                {isSyncing ? (
                    <div className="w-full max-w-sm space-y-2">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{syncStatus}</p>
                    </div>
                ) : (
                    <div className="flex justify-center w-full max-w-md mx-auto">
                        <button 
                            onClick={() => handleStartSync()}
                            className={`p-5 rounded-3xl border flex flex-col items-center gap-2.5 w-full transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer ${isDark ? 'bg-slate-900 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-xl'}`}
                        >
                            <div className={`w-11 h-11 rounded-full ${activeColors.primary} text-white flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </div>
                            <div className="text-center">
                                <span className="block text-sm font-black uppercase tracking-widest mb-1">{appLang === 'bn' ? 'দ্বিমুখী মাস্টার ডাটাবেস সিঙ্ক' : 'MANUAL DATABASE SYNC'}</span>
                                <span className="block text-[10px] opacity-60 font-bold max-w-[280px] mx-auto">
                                    {xamppEnabled ? 'Local XAMPP ↔ IndexedDB ↔ Firebase' : 'IndexedDB (Local Storage) ↔ Firebase Cloud'}
                                </span>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
