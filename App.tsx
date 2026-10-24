import React, { lazy, Suspense } from 'react';

import { TranscriptOutput } from './features/transcript/TranscriptOutput';
import { AppLayout } from './components/layout/AppLayout';
const AppModalsContainer = lazy(() => import('./AppModalsContainer').then(module => ({ default: module.AppModalsContainer })));
import { useAppCore } from './hooks/useAppCore';
import { 
  getSidebarProps, 
  getAppModalsProps, 
  getExpandedHistoryProps, 
  getTranscriptOutputProps 
} from './hooks/useAppProps';

const App: React.FC = () => {
  const core = useAppCore();

  return (
    <AppLayout 
      core={core}
      modals={
        <Suspense fallback={null}>
          <AppModalsContainer {...getAppModalsProps(core)} />
        </Suspense>
      }
    >
      {core.isExtendedPause && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <div className="text-red-500 text-[12rem] font-black leading-none animate-pulse drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
            {core.batchCountdown}
          </div>
          <div className="text-white text-2xl font-medium mt-8 tracking-wide animate-pulse">
            {(core.t as Partial<Record<string, string>>).rateLimitPause || "Waiting for API rate limit..."}
          </div>
        </div>
      )}
      
      <TranscriptOutput {...getTranscriptOutputProps(core)} />
    </AppLayout>
  );
};

export default App;
