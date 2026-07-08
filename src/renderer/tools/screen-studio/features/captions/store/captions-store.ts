import { create } from 'zustand';
import type { CaptionSettings } from '@screen-studio/types/project';

interface CaptionsStoreState extends CaptionSettings {
  toggleEnabled: () => void;
  setSegments: (segments: CaptionSettings['segments']) => void;
}

export const useCaptionsStore = create<CaptionsStoreState>((set) => ({
  enabled: false,
  language: 'en',
  segments: [],
  toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
  setSegments: (segments) => set({ segments })
}));
