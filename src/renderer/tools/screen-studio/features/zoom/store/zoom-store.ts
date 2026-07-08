import { create } from 'zustand';
import type { ZoomKeyframe } from '@screen-studio/types/timeline';
import { DEFAULT_ZOOM_DEPTH, DEFAULT_ZOOM_DURATION_MS } from '@shared/constants';

interface ZoomStoreState {
  mode: 'auto' | 'manual';
  keyframes: ZoomKeyframe[];
  setMode: (mode: 'auto' | 'manual') => void;
  addKeyframe: (atMs: number) => void;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, patch: Partial<Omit<ZoomKeyframe, 'id'>>) => void;
}

export const useZoomStore = create<ZoomStoreState>((set) => ({
  mode: 'auto',
  keyframes: [],
  setMode: (mode) => set({ mode }),
  addKeyframe: (atMs) =>
    set((state) => ({
      keyframes: [
        ...state.keyframes,
        {
          id: crypto.randomUUID(),
          atMs,
          durationMs: DEFAULT_ZOOM_DURATION_MS,
          depth: DEFAULT_ZOOM_DEPTH,
          easing: 'ease-in-out',
          position: 'auto-cursor'
        }
      ]
    })),
  removeKeyframe: (id) =>
    set((state) => ({ keyframes: state.keyframes.filter((k) => k.id !== id) })),
  updateKeyframe: (id, patch) =>
    set((state) => ({
      keyframes: state.keyframes.map((k) => (k.id === id ? { ...k, ...patch } : k))
    }))
}));
