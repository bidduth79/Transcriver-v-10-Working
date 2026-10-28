import { create } from 'zustand';
import type { FileMeta } from '../../types';

export interface RunningJob {
  name: string;
  meta: Partial<FileMeta>;
  file?: File;
}

export interface FinishedJob {
  name: string;
  historyId?: string;
  error?: string;
}

interface BackgroundJobState {
  // The transcription in progress, if any
  running: RunningJob | null;
  // A saved transcript is open: the running job (and a batch's next files) must not take over the screen
  inBackground: boolean;
  // What a job did while it ran in the background, until it is opened or dismissed
  finished: FinishedJob | null;
  setRunning: (job: RunningJob | null) => void;
  setInBackground: (value: boolean) => void;
  setFinished: (job: FinishedJob | null) => void;
}

export const useBackgroundJobStore = create<BackgroundJobState>(set => ({
  running: null,
  inBackground: false,
  finished: null,
  setRunning: running => set({ running }),
  setInBackground: inBackground => set({ inBackground }),
  setFinished: finished => set({ finished }),
}));

// True while a saved transcript is open over a running transcription
export const isJobInBackground = () => useBackgroundJobStore.getState().inBackground;

// Opening a saved transcript while a transcription runs: the transcription goes on in the background
export const moveRunningJobToBackground = () => {
  const store = useBackgroundJobStore.getState();
  if (store.running) store.setInBackground(true);
};
