import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import {
  DEFAULT_ZOOM_DEPTH,
  DEFAULT_ZOOM_DURATION_MS,
  DEFAULT_ZOOM_HOLD_TRANSITION_MS
} from '@shared/constants';

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
 * Clicks fired within `MIN_GAP_MS` of the previously kept click (a rapid
 * double-click, or a small cluster of clicks while the user is still
 * interacting with the same area) extend that keyframe's window rather than
 * starting a new overlapping zoom.
 */
export function generateAutoZoomKeyframes(clickSamples: CursorSample[]): ZoomKeyframe[] {
  if (clickSamples.length === 0) return [];

  const sorted = [...clickSamples].sort((a, b) => a.atMs - b.atMs);
  const keyframes: ZoomKeyframe[] = [];

  for (const click of sorted) {
    const last = keyframes[keyframes.length - 1];
    if (last && click.atMs - last.atMs < MIN_GAP_MS) {
      last.durationMs = click.atMs - last.atMs + DEFAULT_ZOOM_DURATION_MS;
      continue;
    }
    keyframes.push({
      id: crypto.randomUUID(),
      atMs: click.atMs,
      durationMs: DEFAULT_ZOOM_DURATION_MS,
      depth: DEFAULT_ZOOM_DEPTH,
      easing: 'ease-in-out',
      position: 'auto-cursor',
      holdTransitionMs: DEFAULT_ZOOM_HOLD_TRANSITION_MS
    });
  }

  return keyframes;
}
