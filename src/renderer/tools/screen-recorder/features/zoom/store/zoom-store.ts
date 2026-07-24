import { create } from 'zustand';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import {
  DEFAULT_ZOOM_DEPTH,
  DEFAULT_ZOOM_DURATION_MS,
  DEFAULT_ZOOM_HOLD_TRANSITION_MS
} from '@shared/constants';
import { withHistory } from '../../history/lib/with-history';
import { clampToNonOverlapping } from '../lib/zoom-overlap';

/**
 * The existing keyframe (if any) whose range already contains `atMs` --
 * same inclusive-both-ends check `resolveZoom` uses (zoom-resolve.ts), so
 * this agrees with however playback/export would actually resolve that
 * instant. Used to suppress the zoom tool's hover ghost and click-to-place
 * over a stretch that's already covered, rather than letting a click there
 * silently snap a new keyframe in right after the existing one (see
 * `clampToNonOverlapping` above).
 */
export function findKeyframeContaining(
  keyframes: ZoomKeyframe[],
  atMs: number
): ZoomKeyframe | null {
  return keyframes.find((k) => atMs >= k.atMs && atMs <= k.atMs + k.durationMs) ?? null;
}

interface ZoomStoreState {
  mode: 'auto' | 'manual';
  keyframes: ZoomKeyframe[];
  /**
   * The keyframe (if any) currently waiting for the user to click the
   * preview stage to set its focal point -- see PreviewStage.tsx's click
   * handler and ZoomKeyframeEditor's "Set focal point" button.
   */
  armedKeyframeId: string | null;
  /**
   * Which keyframe is focused -- set by clicking a pill in ZoomTrack (which
   * renders independently of the Zoom panel, in CutTimeline) so the panel
   * can highlight and scroll to the matching card, or by clicking a card
   * directly in the panel itself.
   */
  selectedKeyframeId: string | null;
  setMode: (mode: 'auto' | 'manual') => void;
  /** Returns the new keyframe's id, so callers can immediately arm positioning for it. */
  addKeyframe: (atMs: number) => string;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, patch: Partial<Omit<ZoomKeyframe, 'id'>>) => void;
  armPositioning: (id: string) => void;
  disarmPositioning: () => void;
  setSelectedKeyframeId: (id: string | null) => void;
  setKeyframes: (keyframes: ZoomKeyframe[]) => void;
}

export const useZoomStore = create<ZoomStoreState>(
  withHistory(
    'zoom',
    (s) => ({ mode: s.mode, keyframes: s.keyframes }),
    (set) => ({
      mode: 'auto',
      keyframes: [],
      armedKeyframeId: null,
      selectedKeyframeId: null,
      setMode: (mode) => set({ mode }),
      addKeyframe: (atMs) => {
        const id = crypto.randomUUID();
        set((state) => {
          const clamped = clampToNonOverlapping(
            state.keyframes,
            null,
            atMs,
            DEFAULT_ZOOM_DURATION_MS
          );
          return {
            keyframes: [
              ...state.keyframes,
              {
                id,
                atMs: clamped.atMs,
                durationMs: clamped.durationMs,
                depth: DEFAULT_ZOOM_DEPTH,
                easing: 'ease-in-out',
                position: 'auto-cursor',
                holdTransitionMs: DEFAULT_ZOOM_HOLD_TRANSITION_MS
              }
            ]
          };
        });
        return id;
      },
      removeKeyframe: (id) =>
        set((state) => ({
          keyframes: state.keyframes.filter((k) => k.id !== id),
          armedKeyframeId: state.armedKeyframeId === id ? null : state.armedKeyframeId,
          selectedKeyframeId: state.selectedKeyframeId === id ? null : state.selectedKeyframeId
        })),
      updateKeyframe: (id, patch) =>
        set((state) => ({
          keyframes: state.keyframes.map((k) => {
            if (k.id !== id) return k;
            // Only re-clamp when the patch actually touches timing --
            // depth/easing/position/holdTransitionMs patches don't need
            // (or want) the overlap check.
            if (patch.atMs === undefined && patch.durationMs === undefined) {
              return { ...k, ...patch };
            }
            const clamped = clampToNonOverlapping(
              state.keyframes,
              id,
              patch.atMs ?? k.atMs,
              patch.durationMs ?? k.durationMs
            );
            return { ...k, ...patch, atMs: clamped.atMs, durationMs: clamped.durationMs };
          })
        })),
      armPositioning: (id) => set({ armedKeyframeId: id }),
      disarmPositioning: () => set({ armedKeyframeId: null }),
      setSelectedKeyframeId: (selectedKeyframeId) => set({ selectedKeyframeId }),
      setKeyframes: (keyframes) => set({ keyframes, armedKeyframeId: null })
    })
  )
);
