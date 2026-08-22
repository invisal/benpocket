// The actual smoothing/sampling logic lives in @shared/cursor-path so the
// main-process export compositor can draw the exact same trajectory as this
// live preview -- this file just re-exports it as the cursor feature's
// canonical entry point.
export {
  smoothCursorPath,
  sampleCursorPath,
  resolveClickBounceScale,
  resolveClickRipple,
  resolveCursorGesture,
  resolveResizeRotationDeg,
  resolveActiveResizeRotationDeg
} from '@shared/cursor-path';
export type {
  CursorPathPoint,
  ClickRipple,
  CursorGesture,
  ResizeRotationDeg,
  WindowResizeSample,
  CursorCrosshairSample,
  CursorTextSelectSample
} from '@shared/cursor-path';
