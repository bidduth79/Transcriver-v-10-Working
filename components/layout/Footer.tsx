
import React, { useState, useEffect, useRef } from 'react';
import { initDB } from '../../services/db.ts';
import { getApiUrl, checkCloudConnection } from '../../services/api.ts';
import { isLocalServerEnabled } from '../../utils/config';
import { 
  getApiCallLogs, 
  ApiCallLog, 
  setActiveModel, 
  AVAILABLE_MODELS, 
  MODEL_CATEGORY_GROUPS,
  AIModelDefinition,
  getModelDefinition,
  isSpeedOptimizationEnabled,
  setSpeedOptimizationEnabled,
  resetModelToClassicDefault,
  DEFAULT_MODEL
} from '../../services/ApiKeyManager.ts';
import { ShortcutModal } from '../modals/ShortcutModal';
import { MemoryWidget } from './MemoryWidget';

interface FooterProps {
  t: any;
  activeColors: any;
  activeApiKeySource?: string;
  activeModelName?: string;
  totalApiCalls?: number;
  isAiLoading?: boolean;
  onKeyUpdate?: () => void;
  appLang: 'bn' | 'en'; 
  isDark: boolean;
  onOpenSettings?: () => void;      
}

export const Footer: React.FC<FooterProps> = ({ 
  t, 
  activeColors, 
  activeApiKeySource = 'Environment', 
  activeModelName = 'gemini-2.5-flash',
  totalApiCalls = 0,
  isAiLoading = false,
  onKeyUpdate,
  appLang,
  isDark,
  onOpenSettings
}) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<AIModelDefinition | null>(null);
  const [speedOpt, setSpeedOpt] = useState<boolean>(() => isSpeedOptimizationEnabled());
  const [resetNotice, setResetNotice] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [cloudStatus, setCloudStatus] = useState<{ status: 'checking' | 'online' | 'offline' | 'auth-error', message: string }>({ status: 'checking', message: 'Connecting...' });
  const modelSelectRef = useRef<HTMLDivElement>(null);

  const currentModelDef = getModelDefinition(activeModelName);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
        setShowModelSelect(false);
        setHoveredModel(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelSelect = (modelId: string) => {
    setActiveModel(modelId);
    setShowModelSelect(false);
    setHoveredModel(null);
    if (onKeyUpdate) onKeyUpdate();
  };

  const handleToggleSpeedOpt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !speedOpt;
    setSpeedOpt(next);
    setSpeedOptimizationEnabled(next);
    if (onKeyUpdate) onKeyUpdate();
  };

  const handleResetToDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetModelToClassicDefault();
    setSpeedOpt(false);
    setResetNotice(true);
    if (onKeyUpdate) onKeyUpdate();
    setTimeout(() => {
      setResetNotice(false);
      setShowModelSelect(false);
    }, 1200);
  };

  // Check Local XAMPP & Cloud Status
  useEffect(() => {
    const checkSystems = async () => {
      // 1. Check Local (Only if enabled in settings)
      if (isLocalServerEnabled()) {
        try {
          const response = await fetch(getApiUrl('get_personnel.php'));
          if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'online') {
              setServerStatus('online');
            } else {
              setServerStatus('offline');
            }
          } else {
            setServerStatus('offline');
          }
        } catch (e) {
          setServerStatus('offline');
        }
      } else {
        setServerStatus('offline');
      }

      // 2. Check Cloud
      const cloud = await checkCloudConnection();
      setCloudStatus(cloud);
    };

    checkSystems();
    const interval = setInterval(checkSystems, 60000); // Check every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const getCloudStatusColor = () => {
      switch(cloudStatus.status) {
          case 'online': return 'text-green-500';
          case 'auth-error': return 'text-amber-500'; // Auth off
          default: return 'text-red-500';
      }
  };

  const getCloudStatusBg = () => {
      switch(cloudStatus.status) {
          case 'online': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]';
          case 'auth-error': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]';
          default: return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]';
      }
  };

  return (
    <footer className="bg-slate-950 px-8 py-3 hidden md:flex flex-col md:flex-row items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase gap-4 z-[60] border-t border-white/5 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] relative">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 ${activeColors.primary} rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.4)]`}></div>
           <span className="text-white/80">{t.proMode}</span>
        </div>
        
        <span className="opacity-20 text-white">|</span>

        {/* XAMPP SERVER STATUS */}
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
            <span className={`${serverStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                {serverStatus === 'online' ? 'LOCAL DB: ONLINE' : 'LOCAL DB: OFFLINE'}
            </span>
        </div>

        <span className="opacity-20 text-white">|</span>

        {/* CLOUD STATUS */}
        <div className="flex items-center gap-2" title={cloudStatus.message}>
            <div className={`w-2 h-2 rounded-full ${getCloudStatusBg()}`}></div>
            <span className={getCloudStatusColor()}>
                {cloudStatus.status === 'online' ? 'CLOUD SYNC: ON' : cloudStatus.status === 'auth-error' ? 'CLOUD: AUTH ERROR' : 'CLOUD: OFF'}
            </span>
        </div>
        
        <span className="opacity-20 text-white">|</span>
        
        {/* Dynamic Categorized Model Selector */}
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
              <span className={`text-[8px] font-black tracking-widest transition-all duration-300 ${isAiLoading ? 'text-rose-400' : 'text-amber-400/50'}`}>
                {isAiLoading ? 'NEURAL ENGINE PROCESSING...' : `${currentModelDef.categoryLabelBn} • ${speedOpt ? 'FAST OPT' : 'CLASSIC'}`}
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
                 <span className="block text-[11px] text-white font-black tracking-wider">
                   এআই মডেল ও স্পিড ক্যাটাগরি নির্বাচন করুন
                 </span>
                 <span className="block text-[9px] text-slate-400 font-medium normal-case tracking-normal mt-0.5">
                   যেকোনো মডেলের ডানপাশের <b className="text-indigo-400">(i)</b> বাটনে মাউস রাখলে বাংলায় পূর্ণ নির্দেশনা দেখবেন
                 </span>
               </div>
               <button
                 type="button"
                 onClick={handleToggleSpeedOpt}
                 title="ফাস্ট থিংকিং অপ্টিমাইজেশন চালু/বন্ধ করুন"
                 className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider uppercase border transition-all cursor-pointer shrink-0 ${
                   speedOpt 
                     ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                     : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
                 }`}
               >
                 {speedOpt ? '⚡ স্পিড বুস্ট: চালু' : 'স্পিড বুস্ট: বন্ধ'}
               </button>
             </div>

             {/* Categorized Groups */}
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

             {/* Safe Rollback / Reset to Previous Default Footer Bar */}
             <div className="p-2.5 border-t border-white/10 bg-slate-950/90 rounded-b-2xl flex items-center justify-between gap-2">
               <span className="text-[9px] text-slate-400 normal-case tracking-normal font-medium">
                 {resetNotice 
                   ? '✅ পূর্বের ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে!' 
                   : 'কোনো সমস্যা হলে ১ ক্লিকে পূর্বের অবস্থায় ফিরুন:'}
               </span>
               <button
                 type="button"
                 onClick={handleResetToDefault}
                 className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[9px] font-black normal-case tracking-normal transition-all cursor-pointer shrink-0"
               >
                 ↺ পূর্বের অবস্থায় রিসেট করুন
               </button>
             </div>

             {/* Floating Bengali Instruction Tooltip Card when hovering (i) button */}
             {hoveredModel && (
               <div 
                 onMouseEnter={() => setHoveredModel(hoveredModel)}
                 onMouseLeave={() => setHoveredModel(null)}
                 className="absolute bottom-4 left-full ml-3 w-80 bg-slate-900/98 backdrop-blur-2xl border border-indigo-500/40 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] z-[80] text-left normal-case tracking-normal pointer-events-auto"
               >
                 <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
                   <div>
                     <span className="text-xs font-black text-white block">{hoveredModel.label}</span>
                     <span className="text-[10px] font-bold text-indigo-400">{hoveredModel.categoryLabelBn} • {hoveredModel.speedBadgeBn}</span>
                   </div>
                   <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-serif italic font-black">
                     i
                   </span>
                 </div>

                 <div className="space-y-2.5 text-[11px] leading-relaxed text-slate-200">
                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-indigo-300 font-black block text-[10px] mb-0.5">⚙️ কীভাবে কাজ করে:</span>
                     <p className="text-slate-300 font-normal">{hoveredModel.infoBn.howItWorks}</p>
                   </div>

                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-emerald-300 font-black block text-[10px] mb-0.5">⏱️ গতি ও সময়:</span>
                     <p className="text-slate-300 font-normal">{hoveredModel.infoBn.speedAndTime}</p>
                   </div>

                   <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                     <span className="text-amber-300 font-black block text-[10px] mb-0.5">🎯 কখন ব্যবহার করবেন:</span>
                     <p className="text-slate-300 font-normal">{hoveredModel.infoBn.bestFor}</p>
                   </div>

                   <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 px-1">
                     <span>📊 কোটা তথ্য:</span>
                     <span className="text-slate-200 font-bold">{hoveredModel.infoBn.quotaInfo}</span>
                   </div>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 relative">
        <MemoryWidget isDark={isDark} />
        
        <button 
            onClick={() => setShowShortcutModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border cursor-pointer ${isDark ? 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'}`}
            title="Keyboard Shortcuts"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            SHORTCUTS
        </button>

        <div 
          className="relative group py-1"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          {/* Profile Popup */}
          <div 
            className={`absolute bottom-full right-0 w-80 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] pb-6 ${showProfile ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className={`absolute -top-20 -right-20 w-40 h-40 ${activeColors.primary} opacity-20 blur-[80px] rounded-full`}></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${activeColors.primary} flex items-center justify-center text-white shadow-2xl transition-transform duration-500 group-hover:rotate-6`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-white leading-tight font-stylish-bn">ল্যাঃ নাঃ সিটি রাকিব</h4>
                    <p className={`text-[10px] font-black tracking-widest ${activeColors.text} mt-1`}>LNK CT R@KIB</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <a href="tel:01829300000" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all group/item no-underline">
                    <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform group-hover/item:bg-green-500 group-hover/item:text-white">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.1 15.1 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.27 11.72 11.72 0 003.7.59 1 1 0 011 1V20a1 1 0 01-1 1A19 19 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.7 1 1 0 01-.27 1.11l-2.2 2.2z"/></svg>
                    </div>
                    <div>
                      <span className="block text-[8px] text-white/40 font-black tracking-tighter uppercase mb-0.5">Mobile Number</span>
                      <span className="text-white text-[11px] font-bold tracking-widest tabular-nums group-hover/item:text-green-400 transition-colors">01829300000</span>
                    </div>
                  </a>

                  <a href="mailto:biduth79@gmail.com" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all group/item no-underline">
                    <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform group-hover/item:bg-blue-500 group-hover/item:text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <div>
                      <span className="block text-[8px] text-white/40 font-black tracking-tighter uppercase mb-0.5">Email Address</span>
                      <span className="text-white text-[10px] font-bold tracking-tight lowercase group-hover/item:text-blue-400 transition-colors">biduth79@gmail.com</span>
                    </div>
                  </a>
                </div>
                
                <div className="absolute top-full right-8 -mt-2 w-4 h-4 bg-slate-900/95 rotate-45 border-r border-b border-white/10 z-0"></div>
              </div>
            </div>
          </div>

          <a 
              href="https://wa.me/8801829300000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-indigo-400 cursor-pointer transition-all group active:scale-95 no-underline"
          >
              <span className="mr-3 group-hover:text-white transition-all text-[9px] text-white/60 font-black">PROJECT BY R@KIB</span>
              <div className={`w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center group-hover:${activeColors.primary} group-hover:text-white group-hover:rotate-12 transition-all border border-white/10 shadow-inner ring-offset-slate-950 group-hover:ring-2 group-hover:ring-white/20`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.407 3.481 2.242 2.242 3.48 5.23 3.481 8.411-.003 6.557-5.338 11.892-11.893 11.892-1.997 0-3.951-.5-5.688-1.448l-6.3 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.886.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884 0 2.225.569 3.967 1.751 5.634l-.999 3.648 3.737-.981z"/></svg>
              </div>
          </a>
        </div>
      </div>

      <ShortcutModal 
        isOpen={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
        isDark={isDark}
        activeColors={activeColors}
        appLang={appLang}
      />
    </footer>
  );
};
