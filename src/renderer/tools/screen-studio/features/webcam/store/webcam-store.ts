import { create } from 'zustand';
import type { WebcamOptions } from '@screen-studio/types/recording';

interface WebcamStoreState extends WebcamOptions {
  setShape: (shape: WebcamOptions['shape']) => void;
  setMirrored: (mirrored: boolean) => void;
  setPosition: (position: WebcamOptions['position']) => void;
  setSize: (size: number) => void;
  toggleEnabled: () => void;
}

export const useWebcamStore = create<WebcamStoreState>((set) => ({
  enabled: false,
  shape: 'circle',
  mirrored: true,
  position: { x: 24, y: 24 },
  size: 180,
  setShape: (shape) => set({ shape }),
  setMirrored: (mirrored) => set({ mirrored }),
  setPosition: (position) => set({ position }),
  setSize: (size) => set({ size }),
  toggleEnabled: () => set((state) => ({ enabled: !state.enabled }))
}));
