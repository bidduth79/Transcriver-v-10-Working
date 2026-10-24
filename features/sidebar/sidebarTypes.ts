// Props of the sidebar sections, taken from what getSidebarProps() hands the sidebar
import type { SidebarProps } from '../../hooks/useAppProps';
import type { useSidebar } from './hooks/useSidebar';
import type { HistoryGroups } from './utils/historyListUtils';
import type { GetSensitiveMatches } from './historyCardTypes';

export type { SidebarProps };
type SidebarTools = ReturnType<typeof useSidebar>;

export type AudioVideoInputProps =
  Pick<SidebarProps, 't' | 'isRecording' | 'activeColors' | 'cardBg' | 'cardBorder' | 'fileInputRef' | 'onStartRecording'
    | 'handleFileChange' | 'isDark' | 'appLang' | 'recordingTime' | 'onStopRecording'>
  & Pick<SidebarTools, 'activeTab' | 'setActiveTab' | 'handleYouTubeSuccess' | 'formatTime'>
  & { getHeaderTitle: () => string };

export type BatchProcessingQueueProps = Pick<SidebarProps, 'appLang' | 'isDark' | 'cardBg' | 'cardBorder' | 'activeColors'
  | 'history' | 'batchQueue' | 'currentBatchIndex' | 'isBatchProcessing' | 'hasBatchStarted' | 'isBatchPaused'
  | 'batchCountdown' | 'failedFiles' | 'retryFailedFiles' | 'progress' | 'etaSeconds' | 'startBatch' | 'pauseBatch'
  | 'resumeBatch' | 'cancelBatch' | 'skipNextBatchFile' | 'removeBatchFile' | 'jumpToBatchFile'>;

export type FileInfoSectionProps =
  Pick<SidebarProps, 'fileUrl' | 'isRecording' | 't' | 'resetAll' | 'cardBg' | 'cardBorder' | 'isDark' | 'subTextColor'
    | 'fileMeta' | 'activeColors' | 'audioRef' | 'handleTimeUpdate' | 'processTranscription' | 'setIsSidebarOpen' | 'status'>
  & Pick<SidebarTools, 'skipTime' | 'playbackRate' | 'changePlaybackRate'>;

export type SidebarHistoryProps =
  Pick<SidebarProps, 't' | 'history' | 'fullHistory' | 'isLoadingHistory' | 'setIsHistoryFullscreen' | 'cardBg' | 'cardBorder'
    | 'activeHistoryId' | 'loadHistoryItem' | 'onDeleteHistoryItem' | 'isDark' | 'activeColors' | 'appLang'
    | 'historyLimit' | 'setHistoryLimit' | 'showFavoritesOnly' | 'setShowFavoritesOnly' | 'toggleFavorite'
    | 'backupHistory' | 'restoreHistory' | 'histSentimentFilter' | 'setHistSentimentFilter' | 'totalHistoryCount'>
  & {
    groupedHistory: HistoryGroups;
    getSensitiveMatches: GetSensitiveMatches;
    bottomRef: (node: HTMLDivElement | null) => void;
    isHistoryLoading: boolean;
    scrollContainerEl: HTMLDivElement | null;
  };
