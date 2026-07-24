import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import {
  DEFAULT_ZOOM_DEPTH,
  DEFAULT_ZOOM_DURATION_MS,
  DEFAULT_ZOOM_HOLD_TRANSITION_MS
} from '@shared/constants';
import { clampToNonOverlapping } from '../lib/zoom-overlap';

export interface CursorSample {
  atMs: number;
  x: number;
  y: number;
}

/** Clicks closer together than this get folded into the same keyframe (see below) rather than producing back-to-back overlapping zooms. */
const MIN_GAP_MS = DEFAULT_ZOOM_DURATION_MS;

/**
 * Turns recorded click positions (real mousedown events, see
 * click-tracker.ts) into zoom *windows*: a click decides when to zoom in and
 * for how long, but the focal point itself is `'auto-cursor'` -- resolved
 * against the actually-recorded cursor path at render time (see
 * zoom-resolve.ts) -- so the zoom follows the mouse for the whole window
 * instead of freezing on the single pixel that was clicked.
 *
 * Clicks fired within `MIN_GAP_MS` of the previously kept *click* (a rapid
 * double-click, or a small cluster of clicks while the user is still
 * interacting with the same area -- e.g. click somewhere, then move fast
 * and click somewhere else) extend that keyframe's window rather than
 * starting a new overlapping zoom. The gap is measured from the last click
 * actually folded into the cluster, not from the cluster's own `atMs` --
 * comparing against `atMs` would let a long-running cluster's *extended*
 * window silently outgrow the fixed `MIN_GAP_MS` check, so a later click
 * still inside that extended window could slip past it and spawn a second,
 * overlapping keyframe instead of joining the first.
 *
 * Every window (new or extended) is run through the same
 * `clampToNonOverlapping` manual placement uses, rather than trusting the
 * clustering math above to keep windows apart on its own -- that math
 * assumed a fixed relationship between the gap threshold and the default
 * duration that a chain of merges could quietly violate (extending toward,
 * or past, the next click's own window), and had no upper bound at all, so
 * a long burst of clicks a bit over `MIN_GAP_MS` apart could grow one
 * window past `ZOOM_MAX_DURATION_MS` and into the next keyframe entirely.
 * Clamping every window against its neighbors as it's built makes
 * "never overlapping" an actual guarantee instead of an emergent property
 * of the clustering constants happening to line up.
 */
export function generateAutoZoomKeyframes(clickSamples: CursorSample[]): ZoomKeyframe[] {
  if (clickSamples.length === 0) return [];

  const sorted = [...clickSamples].sort((a, b) => a.atMs - b.atMs);
  const keyframes: ZoomKeyframe[] = [];
  let lastClickAtMs = -Infinity;

  for (const click of sorted) {
    const last = keyframes[keyframes.length - 1];
    if (last && click.atMs - lastClickAtMs < MIN_GAP_MS) {
      // Never shrink a window an earlier merge already extended, even if
      // this particular click's own reach is smaller.
      const desiredDurationMs = Math.max(
        last.durationMs,
        click.atMs - last.atMs + DEFAULT_ZOOM_DURATION_MS
      );
      const clamped = clampToNonOverlapping(keyframes, last.id, last.atMs, desiredDurationMs);
      last.durationMs = clamped.durationMs;
      lastClickAtMs = click.atMs;
      continue;
    }
    const clamped = clampToNonOverlapping(keyframes, null, click.atMs, DEFAULT_ZOOM_DURATION_MS);
    keyframes.push({
      id: crypto.randomUUID(),
      atMs: clamped.atMs,
      durationMs: clamped.durationMs,
      depth: DEFAULT_ZOOM_DEPTH,
      easing: 'ease-in-out',
      position: 'auto-cursor',
      holdTransitionMs: DEFAULT_ZOOM_HOLD_TRANSITION_MS
    });
    lastClickAtMs = click.atMs;
  }

  return keyframes;
}
