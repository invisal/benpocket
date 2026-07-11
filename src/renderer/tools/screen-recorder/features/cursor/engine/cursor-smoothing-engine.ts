// The actual smoothing/sampling logic lives in @shared/cursor-path so the
// main-process export compositor can draw the exact same trajectory as this
// live preview -- this file just re-exports it as the cursor feature's
// canonical entry point.
export { smoothCursorPath, sampleCursorPath, resolveClickBounceScale } from '@shared/cursor-path';
export type { CursorPathPoint } from '@shared/cursor-path';
