import { useEffect, useEffectEvent, useRef } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import {
  type WatchFolderHandle, isFolderWatchSupported, pickWatchFolder, canReadFolder, listFolderFiles,
  saveWatchFolder, loadWatchFolder, forgetWatchFolder,
} from '../services/watchFolder';
import { pickNewFiles, fileKey } from './batch/folderWatchUtils';
import { useHistoryStore } from './useHistoryStore';
import { useBackgroundJobStore } from './transcription/useBackgroundJobStore';
import { uiText } from '../utils/uiText';

// 'needsPermission': a folder is saved, but after a reload the browser wants one click before it can be read
export type FolderWatchStatus = 'off' | 'needsPermission' | 'watching';

interface FolderWatchState {
  handle: WatchFolderHandle | null;
  status: FolderWatchStatus;
  setWatch: (handle: WatchFolderHandle | null, status: FolderWatchStatus) => void;
}

export const useFolderWatchStore = create<FolderWatchState>(set => ({
  handle: null,
  status: 'off',
  setWatch: (handle, status) => set({ handle, status }),
}));

const LOOK_EVERY_MS = 15_000;

export const chooseWatchFolder = async (appLang: string) => {
  try {
    const handle = await pickWatchFolder();
    await saveWatchFolder(handle);
    useFolderWatchStore.getState().setWatch(handle, 'watching');
    toast.success(uiText(appLang, 'watchFolderStarted', { name: handle.name }));
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') return;
    toast.error(uiText(appLang, 'watchFolderBlocked'));
  }
};

export const allowWatchFolder = async (appLang: string) => {
  const { handle, setWatch } = useFolderWatchStore.getState();
  if (!handle) return;
  try {
    if (await canReadFolder(handle, true)) setWatch(handle, 'watching');
  } catch {
    toast.error(uiText(appLang, 'watchFolderBlocked'));
  }
};

export const stopWatchFolder = async () => {
  useFolderWatchStore.getState().setWatch(null, 'off');
  try {
    await forgetWatchFolder();
  } catch {
    // Not watched for the rest of this session either way; the saved folder is asked about again after a reload
  }
};

// While the app is open, looks into the watched folder and starts a batch with new audio when nothing else is running
export const useFolderWatch = (appLang: string, isBatchProcessing: boolean, runFiles: (files: File[]) => void) => {
  const handle = useFolderWatchStore(state => state.handle);
  const status = useFolderWatchStore(state => state.status);
  const takenRef = useRef(new Set<string>());
  const lastSizesRef = useRef(new Map<string, number>());
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
        useFolderWatchStore.getState().setWatch(saved, (await canReadFolder(saved, false)) ? 'watching' : 'needsPermission');
      })
      .catch(() => {
        // Nothing saved, or the browser does not allow it here: the folder is simply not watched
      });
  }, []);

  const look = useEffectEvent(async () => {
    const isBusy = () => isBusyRef.current || useBackgroundJobStore.getState().running !== null;
    if (!handle || isBusy()) return;
    let files: File[];
    try {
      files = await listFolderFiles(handle);
    } catch {
      // Moved, deleted, or the permission was taken back
      useFolderWatchStore.getState().setWatch(handle, 'needsPermission');
      return;
    }
    const doneNames = new Set(useHistoryStore.getState().history.map(item => item.fileName));
    const { ready, sizes } = pickNewFiles(files, { doneNames, taken: takenRef.current, lastSizes: lastSizesRef.current });
    lastSizesRef.current = sizes;
    if (ready.length === 0 || isBusy()) return;
    ready.forEach(file => takenRef.current.add(fileKey(file)));
    toast.info(uiText(appLang, 'watchFolderNewFiles', { count: ready.length }));
    runFiles(ready);
  });

  useEffect(() => {
    if (status !== 'watching' || !handle) return;
    look();
    const timer = window.setInterval(look, LOOK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [status, handle]);
};
