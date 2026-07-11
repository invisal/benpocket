import { create } from 'zustand';
import type { CaptionSettings } from '@screen-recorder/types/project';

type CaptionSegment = CaptionSettings['segments'][number];

interface CaptionsStoreState extends CaptionSettings {
  toggleEnabled: () => void;
  setSegments: (segments: CaptionSettings['segments']) => void;
  /** Per-segment patch -- e.g. dragging a caption pill to a new startMs/endMs in CaptionTrack. */
  updateSegment: (id: string, patch: Partial<Omit<CaptionSegment, 'id'>>) => void;
}

export const useCaptionsStore = create<CaptionsStoreState>((set) => ({
  enabled: false,
  language: 'en',
  segments: [],
  toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
  setSegments: (segments) => set({ segments }),
  updateSegment: (id, patch) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, ...patch } : s))
    }))
}));
