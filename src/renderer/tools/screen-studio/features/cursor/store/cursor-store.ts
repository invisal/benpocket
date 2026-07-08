import { create } from 'zustand';
import type { CursorSettings } from '@screen-studio/types/project';

interface CursorStoreState extends CursorSettings {
  setTheme: (theme: string) => void;
  setSize: (size: number) => void;
  setSmoothing: (smoothing: number) => void;
  setClickEffect: (clickEffect: CursorSettings['clickEffect']) => void;
}

export const useCursorStore = create<CursorStoreState>((set) => ({
  theme: 'default',
  size: 1,
  smoothing: 0.3,
  clickEffect: 'ripple',
  setTheme: (theme) => set({ theme }),
  setSize: (size) => set({ size }),
  setSmoothing: (smoothing) => set({ smoothing }),
  setClickEffect: (clickEffect) => set({ clickEffect })
}));
