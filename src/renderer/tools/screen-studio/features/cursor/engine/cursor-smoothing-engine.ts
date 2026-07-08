export interface CursorPathPoint {
  atMs: number;
  x: number;
  y: number;
}

// TODO: post-recording smoothing pass over the raw cursor path (e.g.
// Catmull-Rom spline or exponential smoothing) to remove jitter while
// preserving intentional, fast movements. `_smoothing` is 0 (off) - 1 (max).
export function smoothCursorPath(path: CursorPathPoint[], _smoothing: number): CursorPathPoint[] {
  return path;
}
