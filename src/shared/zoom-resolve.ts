import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { CursorPathPoint } from './cursor-path';
import { sampleCursorPath } from './cursor-path';

/**
 * Resolves the current zoom depth/focal point at `atMs`, shared between the
 * live editor preview (PreviewStage.tsx, CSS transform) and the export
 * compositor (frame-compositor.ts, canvas transform) so both zoom
 * identically -- what you see while editing is what gets exported.
 */
export function easeZoom(t: number, easing: ZoomKeyframe['easing']): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
}

export interface ResolvedZoom {
  depth: number;
  /** Pivot for `scale(depth)` (0-1, normalized) -- e.g. CSS `transform-origin`, or the anchor point in a canvas translate/scale/translate-back. Scaling alone around this point holds it fixed on screen. */
  focal: { x: number; y: number };
  /**
   * Extra translate (0-1, fraction of the content's own size) layered on
   * top of the focal-anchored scale. Scaling around a fixed point keeps
   * that point pinned wherever it originally was on screen (e.g. still
   * near the top if you clicked near the top) -- `shift` gradually drags
   * it toward the center of the frame as the zoom deepens instead, which
   * is what makes a "zoom to this point" read as actually zooming *in on*
   * the point rather than just growing everything around a fixed pin.
   * Zero whenever depth is 1 (not zoomed).
   */
  shift: { x: number; y: number };
}

/**
 * `'auto-cursor'` keyframes track the *real* recorded cursor path (sampled
 * at `atMs`, same smoothing already applied by the caller) rather than a
 * fixed point -- this is what makes auto-zoom actually follow the mouse
 * while zoomed in, instead of zooming into a single frozen spot. Falls back
 * to a fixed center point if there's no cursor data (e.g. a 'window'
 * capture, which never gets a cursor path -- see cursor-tracker.ts).
 * Manually placed keyframes (`position: {x, y}`, set by clicking the
 * preview while positioning is armed) always use that exact fixed point.
 */
export function resolveZoom(
  atMs: number,
  keyframes: ZoomKeyframe[],
  cursorPath: CursorPathPoint[] = []
): ResolvedZoom {
  const identity: ResolvedZoom = { depth: 1, focal: { x: 0.5, y: 0.5 }, shift: { x: 0, y: 0 } };
  const active = keyframes.find((k) => atMs >= k.atMs && atMs <= k.atMs + k.durationMs);
  if (!active) return identity;

  // Per-keyframe: how long the ease-in/ease-out either side of the hold
  // takes (see ZoomKeyframeEditor's "Hold transition" slider). Keyframes
  // shorter than 2x this scale the ramps down instead of overlapping,
  // degrading to a plain ease-in-then-out with no hold.
  const rampMs = Math.min(active.holdTransitionMs, active.durationMs / 2);
  const elapsed = atMs - active.atMs;
  const remaining = active.durationMs - elapsed;
  const envelope =
    rampMs <= 0
      ? 1
      : elapsed < rampMs
        ? easeZoom(elapsed / rampMs, active.easing)
        : remaining < rampMs
          ? easeZoom(remaining / rampMs, active.easing)
          : 1;
  const depth = 1 + (active.depth - 1) * envelope;
  const focal =
    active.position === 'auto-cursor'
      ? (sampleCursorPath(cursorPath, atMs) ?? { x: 0.5, y: 0.5 })
      : active.position;
  // Grows from 0 (rest) to envelope * distance-to-center at the zoom's peak,
  // so the focal point smoothly migrates to center as depth increases and
  // returns to its original spot as the zoom releases.
  const shift = { x: envelope * (0.5 - focal.x), y: envelope * (0.5 - focal.y) };

  return { depth, focal, shift };
}
