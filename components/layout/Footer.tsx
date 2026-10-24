import React, { useState } from 'react';
import { ShortcutModal } from '../modals/ShortcutModal';
import { MemoryWidget } from './MemoryWidget';
import { useSystemStatus } from './footer/useSystemStatus';
import { SystemStatusBar } from './footer/SystemStatusBar';
import { ModelSelector } from './footer/ModelSelector';
import { FooterProfile } from './footer/FooterProfile';
import { DEFAULT_MODEL } from '../../constants/aiModels';
import type { Translations } from '../../translations';
import type { ActiveColors } from '../../hooks/useAppTheme';

interface FooterProps {
  t: Translations;
  activeColors: ActiveColors;
  activeModelName?: string;
  isAiLoading?: boolean;
  onKeyUpdate?: () => void;
  appLang: 'bn' | 'en';
  isDark: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  t,
  activeColors,
  activeModelName = DEFAULT_MODEL,
  isAiLoading = false,
  onKeyUpdate,
  appLang,
  isDark
}) => {
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const { serverStatus, cloudStatus } = useSystemStatus();

  return (
    <footer className="bg-slate-950 px-8 py-3 hidden md:flex flex-col md:flex-row items-center justify-between text-[10px] font-black tracking-widest bn:tracking-normal text-slate-500 uppercase gap-4 z-[60] border-t border-white/5 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] relative">
      <div className="flex items-center gap-6">
        <SystemStatusBar
          proModeLabel={t.proMode}
          primaryColor={activeColors.primary}
          serverStatus={serverStatus}
          cloudStatus={cloudStatus}
        />

        <span className="opacity-20 text-white">|</span>

        {/* Dynamic Categorized Model Selector */}
        <ModelSelector activeModelName={activeModelName} isAiLoading={isAiLoading} onKeyUpdate={onKeyUpdate} />
      </div>

      <div className="flex items-center gap-4 relative">
        <MemoryWidget isDark={isDark} />

        <button
            onClick={() => setShowShortcutModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer ${isDark ? 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'}`}
            title="Keyboard Shortcuts"
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            SHORTCUTS
        </button>

        <FooterProfile activeColors={activeColors} />
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
