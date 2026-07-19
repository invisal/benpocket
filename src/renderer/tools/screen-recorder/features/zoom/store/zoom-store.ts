import { create } from 'zustand';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import {
  DEFAULT_ZOOM_DEPTH,
  DEFAULT_ZOOM_DURATION_MS,
  DEFAULT_ZOOM_HOLD_TRANSITION_MS,
  ZOOM_MIN_DURATION_MS,
  ZOOM_MAX_DURATION_MS
} from '@shared/constants';
import { withHistory } from '../../history/lib/with-history';

/**
 * Clamps a candidate `[atMs, atMs + durationMs)` window so it never
 * overlaps any other keyframe's range -- `resolveZoom` (shared verbatim by
 * the live preview and the export compositor, see zoom-resolve.ts) picks
 * whichever keyframe's range contains a given moment via a plain `.find`,
 * so an overlap would make that pick order-dependent and effectively
 * undefined rather than just a cosmetic timeline glitch. `excludeId` is the
 * keyframe being moved/resized (`null` when adding a new one), so it never
 * collides with itself.
 *
 * Finds the nearest existing keyframe ending at/before the desired start
 * and the nearest one starting at/after it -- those bound the free gap the
 * window has to fit into. If the desired start already falls inside
 * another keyframe's range, it snaps forward to just past that keyframe's
 * end (simple, deterministic "push after" resolution rather than trying to
 * guess drag direction).
 */
function clampToNonOverlapping(
  keyframes: ZoomKeyframe[],
  excludeId: string | null,
  desiredAtMs: number,
  desiredDurationMs: number
): { atMs: number; durationMs: number } {
  const others = keyframes.filter((k) => k.id !== excludeId).sort((a, b) => a.atMs - b.atMs);

  let nextIdx = others.findIndex((o) => o.atMs >= desiredAtMs);
  if (nextIdx === -1) nextIdx = others.length;
  const prev = others[nextIdx - 1] ?? null;
  const next = others[nextIdx] ?? null;

  const lowerBound = prev ? prev.atMs + prev.durationMs : 0;
  const upperBound = next ? next.atMs : Infinity;

  const atMs = Math.max(lowerBound, Math.min(desiredAtMs, upperBound));
  const maxGapMs = Math.max(0, upperBound - atMs);
  // Normal [MIN, MAX] bounds first, then a further cap to whatever the gap
  // actually allows -- that second cap can only ever shrink further, and
  // only bites in the rare case where neighbors are packed tighter than
  // ZOOM_MIN_DURATION_MS apart (no valid non-overlapping slot exists at
  // the usual minimum, so "never overlap" wins over "always >= minimum").
  const durationMs = Math.min(
    Math.max(desiredDurationMs, ZOOM_MIN_DURATION_MS),
    ZOOM_MAX_DURATION_MS,
    maxGapMs
  );

  return { atMs, durationMs };
}

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
