import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import {
  DEFAULT_ZOOM_DEPTH,
  DEFAULT_ZOOM_DURATION_MS,
  DEFAULT_ZOOM_EASING,
  DEFAULT_ZOOM_HOLD_TRANSITION_MS
} from '@shared/constants';
import { clampToNonOverlapping } from '../lib/zoom-overlap';

export interface CursorSample {
  atMs: number;
  x: number;
  y: number;
}

/**
 * How long since the previously kept click before the cursor counts as
 * having gone idle -- a next click arriving any later starts a fresh
 * keyframe (subject to `PROXIMITY_THRESHOLD` below too) instead of
 * extending the current one, even if it lands in the same spot.
 */
const IDLE_TIMEOUT_MS = 5000;
/**
 * How close (Euclidean distance, as a fraction of the recording frame) a
 * click has to land to the previously kept click to count as "the same
 * area" -- e.g. 0.35 means within just over a third of the frame's own
 * width/height. Farther than this reads as the user having moved on to
 * interact with something else, even if they clicked again well within
 * `IDLE_TIMEOUT_MS`.
 */
const PROXIMITY_THRESHOLD = 0.35;

/**
 * Turns recorded click positions (real mousedown events, see
 * click-tracker.ts) into zoom *windows*: a click decides when to zoom in and
 * for how long, but the focal point itself is `'auto-cursor'` -- resolved
 * against the actually-recorded cursor path at render time (see
 * zoom-resolve.ts) -- so the zoom follows the mouse for the whole window
 * instead of freezing on the single pixel that was clicked.
 *
 * A click within both `IDLE_TIMEOUT_MS` and `PROXIMITY_THRESHOLD` of the
 * previously kept *click* -- i.e. the user is still clicking around the
 * same area, hasn't gone idle -- extends that keyframe's window rather
 * than starting a new overlapping zoom. Either condition failing (the
 * cursor sat idle too long, or the next click is somewhere else entirely)
 * closes the current window and starts a new one instead, rather than
 * merging unrelated interactions into one long zoom or re-zooming on every
 * single click within the same small area. Both are measured from the
 * last click actually folded into the cluster, not from the cluster's own
 * `atMs` -- comparing against `atMs` would let a long-running cluster's
 * *extended* window silently outgrow the fixed thresholds, so a later
 * click still inside that extended window could slip past them and spawn
 * a second, overlapping keyframe instead of joining the first.
 *
 * Every window (new or extended) is run through the same
 * `clampToNonOverlapping` manual placement uses, rather than trusting the
 * clustering math above to keep windows apart on its own -- that math
 * assumed a fixed relationship between the gap threshold and the default
 * duration that a chain of merges could quietly violate (extending toward,
 * or past, the next click's own window), with no upper bound at all, so a
 * long burst of nearby clicks could grow one window straight into the next
 * keyframe entirely. Clamping every window against its neighbors (and,
 * when there's no next keyframe, the recording's own length -- see
 * clampToNonOverlapping's own doc) as it's built makes "never overlapping"
 * an actual guarantee instead of an emergent property of the clustering
 * constants happening to line up.
 */
export function generateAutoZoomKeyframes(clickSamples: CursorSample[]): ZoomKeyframe[] {
  if (clickSamples.length === 0) return [];

  const sorted = [...clickSamples].sort((a, b) => a.atMs - b.atMs);
  const keyframes: ZoomKeyframe[] = [];
  let lastClick: CursorSample | null = null;

  for (const click of sorted) {
    const last = keyframes[keyframes.length - 1];
    const isIdleTimeout = lastClick === null || click.atMs - lastClick.atMs >= IDLE_TIMEOUT_MS;
    const isDifferentArea =
      lastClick !== null &&
      Math.hypot(click.x - lastClick.x, click.y - lastClick.y) >= PROXIMITY_THRESHOLD;

    if (last && !isIdleTimeout && !isDifferentArea) {
      // Never shrink a window an earlier merge already extended, even if
      // this particular click's own reach is smaller.
      const desiredDurationMs = Math.max(
        last.durationMs,
        click.atMs - last.atMs + DEFAULT_ZOOM_DURATION_MS
      );
      const clamped = clampToNonOverlapping(keyframes, last.id, last.atMs, desiredDurationMs);
      last.durationMs = clamped.durationMs;
      lastClick = click;
      continue;
    }
    const clamped = clampToNonOverlapping(keyframes, null, click.atMs, DEFAULT_ZOOM_DURATION_MS);
    keyframes.push({
      id: crypto.randomUUID(),
      atMs: clamped.atMs,
      durationMs: clamped.durationMs,
      depth: DEFAULT_ZOOM_DEPTH,
      easing: DEFAULT_ZOOM_EASING,
      position: 'auto-cursor',
      holdTransitionMs: DEFAULT_ZOOM_HOLD_TRANSITION_MS,
      enabled: true
    });
    lastClick = click;
  }

  return keyframes;
}
