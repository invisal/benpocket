import { create } from 'zustand';

export interface ToastEntry {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

const TOAST_DURATION_MS = 3000;

interface ToastStoreState {
  toasts: ToastEntry[];
  showToast: (message: string, variant?: ToastEntry['variant']) => void;
  dismissToast: (id: string) => void;
}

/** Fire-and-forget notifications (e.g. "Project saved") -- rendered by ToastViewport, mounted once in ScreenRecorderApp.tsx. */
export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  showToast: (message, variant = 'success') => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));
