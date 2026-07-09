import { create } from 'zustand';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import { DEFAULT_ZOOM_DEPTH, DEFAULT_ZOOM_DURATION_MS } from '@shared/constants';

interface ZoomStoreState {
  mode: 'auto' | 'manual';
  keyframes: ZoomKeyframe[];
  /**
   * The keyframe (if any) currently waiting for the user to click the
   * preview stage to set its focal point -- see PreviewStage.tsx's click
   * handler and ZoomKeyframeEditor's "Set focal point" button.
   */
  armedKeyframeId: string | null;
  setMode: (mode: 'auto' | 'manual') => void;
  /** Returns the new keyframe's id, so callers can immediately arm positioning for it. */
  addKeyframe: (atMs: number) => string;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, patch: Partial<Omit<ZoomKeyframe, 'id'>>) => void;
  armPositioning: (id: string) => void;
  disarmPositioning: () => void;
  /** Replaces every keyframe wholesale -- used to seed auto-generated keyframes (see auto-zoom-engine.ts) once a recording finishes. */
  setKeyframes: (keyframes: ZoomKeyframe[]) => void;
}

export const useZoomStore = create<ZoomStoreState>((set) => ({
  mode: 'auto',
  keyframes: [],
  armedKeyframeId: null,
  setMode: (mode) => set({ mode }),
  addKeyframe: (atMs) => {
    const id = crypto.randomUUID();
    set((state) => ({
      keyframes: [
        ...state.keyframes,
        {
          id,
          atMs,
          durationMs: DEFAULT_ZOOM_DURATION_MS,
          depth: DEFAULT_ZOOM_DEPTH,
          easing: 'ease-in-out',
          position: 'auto-cursor'
        }
      ]
    }));
    return id;
  },
  removeKeyframe: (id) =>
    set((state) => ({
      keyframes: state.keyframes.filter((k) => k.id !== id),
      armedKeyframeId: state.armedKeyframeId === id ? null : state.armedKeyframeId
    })),
  updateKeyframe: (id, patch) =>
    set((state) => ({
      keyframes: state.keyframes.map((k) => (k.id === id ? { ...k, ...patch } : k))
    })),
  armPositioning: (id) => set({ armedKeyframeId: id }),
  disarmPositioning: () => set({ armedKeyframeId: null }),
  setKeyframes: (keyframes) => set({ keyframes, armedKeyframeId: null })
}));
