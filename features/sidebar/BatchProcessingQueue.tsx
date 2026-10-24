import React from 'react';
import { BatchProgressStatus } from './components/BatchProgressStatus';
import { BatchQueueItem } from './components/BatchQueueItem';
import { BatchControls } from './components/BatchControls';
import type { BatchProcessingQueueProps } from './sidebarTypes';
import { uiText } from '../../utils/uiText';

export const BatchProcessingQueue = ({
  appLang,
  isDark,
  cardBg,
  cardBorder,
  activeColors,
  history = [],
  batchQueue = [],
  currentBatchIndex = 0,
  isBatchProcessing = false,
  hasBatchStarted = false,
  isBatchPaused = false,
  batchCountdown = 0,
  failedFiles = [],
  retryFailedFiles,
  progress = 0,
  etaSeconds = null,
  startBatch,
  pauseBatch,
  resumeBatch,
  cancelBatch,
  skipNextBatchFile,
  removeBatchFile,
  jumpToBatchFile
}: BatchProcessingQueueProps) => {
  if (!(isBatchProcessing || failedFiles.length > 0) || batchQueue.length === 0) {
    return null;
  }

  return (
    <div className="px-6 mt-8">
      <div className="flex items-center justify-between bg-slate-950 px-5 py-3 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.4)] border border-white/10 mb-4 h-[52px]">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${activeColors?.primary || 'bg-indigo-600'} shadow-[0_0_12px_rgba(255,255,255,0.4)] shrink-0`}></div>
          <span className="text-[12px] font-black uppercase tracking-[0.15em] bn:tracking-normal text-white truncate">
            {uiText(appLang, 'batchProcessing')}
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full">
          {currentBatchIndex + 1} / {batchQueue.length}
        </span>
      </div>
      
      <div className={`${cardBg} rounded-3xl border ${cardBorder} shadow-[0_15px_35px_rgba(0,0,0,0.2)] overflow-hidden`}>
        <div className="p-4">
        
        <BatchProgressStatus
          appLang={appLang}
          hasBatchStarted={hasBatchStarted}
          progress={progress}
          etaSeconds={etaSeconds}
          batchCountdown={batchCountdown}
        />

        {/* Queue List */}
        <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2 mb-4">
          {batchQueue.map((file, index) => (
            <BatchQueueItem
              key={index}
              file={file}
              index={index}
              appLang={appLang}
              isDark={isDark}
              history={history}
              currentBatchIndex={currentBatchIndex}
              hasBatchStarted={hasBatchStarted}
              isBatchPaused={isBatchPaused}
              failedFiles={failedFiles}
              pauseBatch={pauseBatch}
              resumeBatch={resumeBatch}
              cancelBatch={cancelBatch}
              removeBatchFile={removeBatchFile}
              jumpToBatchFile={jumpToBatchFile}
            />
          ))}
        </div>

        <BatchControls
          appLang={appLang}
          hasBatchStarted={hasBatchStarted}
          isBatchProcessing={isBatchProcessing}
          isBatchPaused={isBatchPaused}
          failedCount={failedFiles.length}
          retryFailedFiles={retryFailedFiles}
          startBatch={startBatch}
          pauseBatch={pauseBatch}
          resumeBatch={resumeBatch}
          skipNextBatchFile={skipNextBatchFile}
          cancelBatch={cancelBatch}
        />
        

        </div>
      </div>
    </div>
  );
};
