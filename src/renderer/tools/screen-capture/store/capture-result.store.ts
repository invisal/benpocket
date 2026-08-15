import { create } from 'zustand';

interface CaptureResultState {
  pending: Blob | null;
  isToolbarOpen: boolean;
  setPending: (blob: Blob) => void;
  takePending: () => Blob | null;
  setToolbarOpen: (open: boolean) => void;
}

export const useCaptureResultStore = create<CaptureResultState>((set, get) => ({
  pending: null,
  isToolbarOpen: false,
  setPending: (blob) => set({ pending: blob }),
  takePending: () => {
    const blob = get().pending;
    if (blob) set({ pending: null });
    return blob;
  },
  setToolbarOpen: (open) => set({ isToolbarOpen: open })
}));
