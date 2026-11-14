import { useEffect, useEffectEvent, useRef } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import {
  type WatchFolderHandle, isFolderWatchSupported, pickWatchFolder, canReadFolder, listFolderFiles,
  saveWatchFolder, loadWatchFolder, forgetWatchFolder, saveWatchPaused, loadWatchPaused,
} from '../services/watchFolder';
import { pickNewFiles } from './batch/folderWatchUtils';
import { claimTabLock } from '../services/tabLock';
import { useHistoryStore } from './useHistoryStore';
import { useBackgroundJobStore } from './transcription/useBackgroundJobStore';
import { uiText } from '../utils/uiText';
import { attachCaptions } from '../services/captions';

// 'needsPermission': a folder is saved, but after a reload the browser wants one click before it can be read.
// 'paused': the folder is kept, but not looked into until it is turned on again.
export type FolderWatchStatus = 'off' | 'needsPermission' | 'watching' | 'paused';
// 'auto': new files are transcribed at once; 'review': they wait in the batch list until the user starts it
export type FolderWatchMode = 'auto' | 'review';

const MODE_STORAGE = 'watchFolderMode';
const readMode = (): FolderWatchMode => {
  try {
    return localStorage.getItem(MODE_STORAGE) === 'review' ? 'review' : 'auto';
  } catch {
    return 'auto';
  }
};

interface FolderWatchState {
  handle: WatchFolderHandle | null;
  status: FolderWatchStatus;
  mode: FolderWatchMode;
  setWatch: (handle: WatchFolderHandle | null, status: FolderWatchStatus) => void;
  setMode: (mode: FolderWatchMode) => void;
}

export const useFolderWatchStore = create<FolderWatchState>(set => ({
  handle: null,
  status: 'off',
  mode: readMode(),
  setWatch: (handle, status) => set({ handle, status }),
  setMode: mode => {
    try {
      localStorage.setItem(MODE_STORAGE, mode);
    } catch {
      // Blocked storage: the choice lasts for this session only
    }
    set({ mode });
  },
}));

const LOOK_EVERY_MS = 15_000;
const WATCH_LOCK = 'transcriver-folder-watch';
// New files are taken at most this many at a time; the rest come once that batch is done
export const MAX_FILES_PER_BATCH = 10;

export const chooseWatchFolder = async (appLang: string) => {
  try {
    const handle = await pickWatchFolder();
    await saveWatchFolder(handle);
    await saveWatchPaused(false);
    useFolderWatchStore.getState().setWatch(handle, 'watching');
    toast.success(uiText(appLang, 'watchFolderStarted', { name: handle.name }));
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') return;
    toast.error(uiText(appLang, 'watchFolderBlocked'));
  }
};

// Also turns a paused folder back on
export const allowWatchFolder = async (appLang: string) => {
  const { handle, setWatch } = useFolderWatchStore.getState();
  if (!handle) return;
  try {
    if (!(await canReadFolder(handle, true))) return setWatch(handle, 'needsPermission');
    setWatch(handle, 'watching');
    await saveWatchPaused(false);
  } catch {
    toast.error(uiText(appLang, 'watchFolderBlocked'));
  }
};

export const pauseWatchFolder = async (appLang: string) => {
  const { handle, setWatch } = useFolderWatchStore.getState();
  if (!handle) return;
  setWatch(handle, 'paused');
  try {
    await saveWatchPaused(true);
  } catch {
    toast.error(uiText(appLang, 'watchFolderBlocked'));
  }
};

export const stopWatchFolder = async () => {
  useFolderWatchStore.getState().setWatch(null, 'off');
  try {
    await forgetWatchFolder();
    await saveWatchPaused(false);
  } catch {
    // Not watched for the rest of this session either way; the saved folder is asked about again after a reload
  }
};

// While the app is open, looks into the watched folder and, when nothing else is running, hands up to ten new
// files to the batch: started at once ('auto'), or listed for the user to check and start ('review')
export const useFolderWatch = (
  appLang: string,
  isBatchProcessing: boolean,
  runFiles: (files: File[]) => void,
  queueFiles: (files: File[]) => void,
) => {
  const handle = useFolderWatchStore(state => state.handle);
  const status = useFolderWatchStore(state => state.status);
  // Files handed to a batch in this session: not taken again, even when they failed
  const takenRef = useRef<File[]>([]);
  const lastSizesRef = useRef(new Map<string, number>());
  const releaseWatchRef = useRef<(() => void) | null>(null);
  // Read after the folder is listed, so a batch started meanwhile is seen
  const isBusyRef = useRef(isBatchProcessing);

  useEffect(() => {
    isBusyRef.current = isBatchProcessing;
  }, [isBatchProcessing]);

  // The folder chosen before a reload
  useEffect(() => {
    if (!isFolderWatchSupported()) return;
    loadWatchFolder()
      .then(async saved => {
        if (!saved) return;
        const { setWatch } = useFolderWatchStore.getState();
        if (await loadWatchPaused()) return setWatch(saved, 'paused');
        setWatch(saved, (await canReadFolder(saved, false)) ? 'watching' : 'needsPermission');
      })
      .catch(() => {
        // Nothing saved, or the browser does not allow it here: the folder is simply not watched
      });
  }, []);

  const look = useEffectEvent(async () => {
    const isBusy = () => isBusyRef.current || useBackgroundJobStore.getState().running !== null;
    if (!handle || isBusy()) return;
    // Only one of the app's tabs looks into the folder; another takes over when that tab closes or stops watching
    releaseWatchRef.current ??= await claimTabLock(WATCH_LOCK);
    if (!releaseWatchRef.current) return;
    // Watching was stopped while the lock was being taken: it is given back at once
    if (useFolderWatchStore.getState().status !== 'watching') {
      releaseWatchRef.current();
      releaseWatchRef.current = null;
      return;
    }
    let files: File[];
    try {
      files = await listFolderFiles(handle);
    } catch {
      // Moved, deleted, or the permission was taken back
      useFolderWatchStore.getState().setWatch(handle, 'needsPermission');
      return;
    }
    const history = useHistoryStore.getState().history.map(item => ({ name: item.fileName, size: item.size }));
    const { ready, sizes } = pickNewFiles(files, { done: [...history, ...takenRef.current], lastSizes: lastSizesRef.current });
    lastSizesRef.current = sizes;
    if (ready.length === 0 || isBusy()) return;
    const batch = ready.slice(0, MAX_FILES_PER_BATCH);
    takenRef.current.push(...batch);
    // YouTube's captions next to each recording, to compare the transcript with
    await attachCaptions(batch, files);
    if (useFolderWatchStore.getState().mode === 'review') {
      toast.info(uiText(appLang, 'watchFolderReviewFiles', { count: batch.length }));
      queueFiles(batch);
    } else {
      toast.info(uiText(appLang, 'watchFolderNewFiles', { count: batch.length }));
      runFiles(batch);
    }
  });

  useEffect(() => {
    if (status !== 'watching' || !handle) return;
    look();
    const timer = window.setInterval(look, LOOK_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      releaseWatchRef.current?.();
      releaseWatchRef.current = null;
    };
  }, [status, handle]);
};
