import type { ZoomKeyframe } from '@screen-studio/types/timeline';

export interface CursorSample {
  atMs: number;
  x: number;
  y: number;
}

// TODO: implement auto-zoom - analyze recorded cursor samples, detect
// "areas of interest" (click clusters, typing bursts, dwell time) and
// synthesize ZoomKeyframes that follow the cursor smoothly (position:
// 'auto-cursor' keyframes are resolved against the live cursor path at
// render time rather than a fixed point).
export function generateAutoZoomKeyframes(_cursorSamples: CursorSample[]): ZoomKeyframe[] {
  return [];
}
