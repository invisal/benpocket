import type { ZoomKeyframe } from '@screen-recorder/types/timeline';

export const DEFAULT_ZOOM_DEPTH = 2.0;
export const DEFAULT_ZOOM_DURATION_MS = 2500;
export const DEFAULT_ZOOM_HOLD_TRANSITION_MS = 1200;
export const DEFAULT_ZOOM_EASING: ZoomKeyframe['easing'] = 'ease-out';
// Shared by ZoomKeyframeEditor's duration slider, ZoomTrack's edge-resize
// handles, and zoom-store's own overlap-prevention clamp -- a keyframe's
// duration stays within the same floor no matter which of those touches it.
// Deliberately no matching MAX constant -- a keyframe's real ceiling is the
// next keyframe's start, or the recording's own length, not an arbitrary
// fixed cap (see clampToNonOverlapping's own doc in zoom-overlap.ts).
export const ZOOM_MIN_DURATION_MS = 200;
/**
 * Webcam/annotation position and size values (e.g. webcam-store's default
 * `{x:24,y:24}`/`size:180`) are authored against this reference canvas and
 * scaled to the actual output resolution at export/render time.
 */
export const REFERENCE_CANVAS_WIDTH = 1280;
