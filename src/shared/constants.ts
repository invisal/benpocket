export const DEFAULT_ZOOM_DEPTH = 2.0;
export const DEFAULT_ZOOM_DURATION_MS = 2500;
export const DEFAULT_ZOOM_HOLD_TRANSITION_MS = 800;
// Shared by ZoomKeyframeEditor's duration slider, ZoomTrack's edge-resize
// handles, and zoom-store's own overlap-prevention clamp -- a keyframe's
// duration stays within the same bounds no matter which of those touches it.
export const ZOOM_MIN_DURATION_MS = 200;
export const ZOOM_MAX_DURATION_MS = 10000;
/**
 * Webcam/annotation position and size values (e.g. webcam-store's default
 * `{x:24,y:24}`/`size:180`) are authored against this reference canvas and
 * scaled to the actual output resolution at export/render time.
 */
export const REFERENCE_CANVAS_WIDTH = 1280;
