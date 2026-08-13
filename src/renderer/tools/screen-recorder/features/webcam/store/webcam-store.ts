import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WebcamOptions } from '@screen-recorder/types/recording';
import { withHistory } from '../../history/lib/with-history';

interface WebcamStoreState extends WebcamOptions {
  setShape: (shape: WebcamOptions['shape']) => void;
  setMirrored: (mirrored: boolean) => void;
  setPosition: (position: WebcamOptions['position']) => void;
  setSize: (size: number) => void;
  setShadow: (shadow: number) => void;
  toggleEnabled: () => void;
}

export const useWebcamStore = create<WebcamStoreState>()(
  persist(
    withHistory(
      'webcam',
      (s) => ({
        enabled: s.enabled,
        shape: s.shape,
        mirrored: s.mirrored,
        position: s.position,
        size: s.size,
        shadow: s.shadow
      }),
      (set) => ({
        enabled: false,
        shape: 'circle',
        mirrored: true,
        position: { x: 24, y: 24 },
        size: 180,
        shadow: 40,
        setShape: (shape) => set({ shape }),
        setMirrored: (mirrored) => set({ mirrored }),
        setPosition: (position) => set({ position }),
        setSize: (size) => set({ size }),
        setShadow: (shadow) => set({ shadow }),
        toggleEnabled: () => set((state) => ({ enabled: !state.enabled }))
      })
    ),
    {
      name: 'craftbox-screen-recorder-webcam-settings',
      // Only the Settings-page defaults (shape/mirrored) survive a restart --
      // enabled/position/size/shadow are scoped to whatever's actually being
      // edited right now (see WebcamPanel.tsx), not a persistent preference.
      partialize: (state) => ({ shape: state.shape, mirrored: state.mirrored })
    }
  )
);
