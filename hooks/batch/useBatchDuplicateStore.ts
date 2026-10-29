import { create } from 'zustand';

// Files of the batch that are already in history are skipped, unless the user chose to transcribe them anyway
interface BatchDuplicateState {
  allowed: File[];
  skipped: File[];
  toggleAllowed: (file: File) => void;
  allow: (file: File) => void;
  addSkipped: (file: File) => void;
  clearSkipped: () => void;
  reset: () => void;
}

export const useBatchDuplicateStore = create<BatchDuplicateState>(set => ({
  allowed: [],
  skipped: [],
  toggleAllowed: file => set(state => ({
    allowed: state.allowed.includes(file) ? state.allowed.filter(f => f !== file) : [...state.allowed, file],
  })),
  allow: file => set(state => (state.allowed.includes(file) ? state : { allowed: [...state.allowed, file] })),
  addSkipped: file => set(state => ({ skipped: [...state.skipped, file] })),
  clearSkipped: () => set({ skipped: [] }),
  reset: () => set({ allowed: [], skipped: [] }),
}));
