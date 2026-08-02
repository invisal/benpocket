import { sampleCursorPath, type CursorPathPoint } from '@shared/cursor-path';

/** The first real recorded mousedown within a window `[atMs, atMs + durationMs]`, if any. */
export function firstClickInWindow(
  clickPath: CursorPathPoint[],
  atMs: number,
  durationMs: number
): { x: number; y: number } | null {
  const click = clickPath.find((c) => c.atMs >= atMs && c.atMs <= atMs + durationMs);
  return click ? { x: click.x, y: click.y } : null;
}

/**
 * A sensible fixed point for a keyframe that isn't following the cursor --
 * prefers the first real click inside its window (matches how auto-generated
 * keyframes are seeded from clicks, see auto-zoom-engine.ts), falling back to
 * wherever the cursor actually was at the keyframe's start, and only landing
 * on dead-center as a last resort (a 'window' capture never gets a cursor
 * path at all). Shared by `ZoomTrack`'s "disable follow cursor" action and
 * `CutTimeline`'s ghost-preview click-to-place, so both land on the same
 * point for the same window instead of drifting apart.
 */
export function resolveFixedPosition(
  clickPath: CursorPathPoint[],
  cursorPath: CursorPathPoint[],
  atMs: number,
  durationMs: number
): { x: number; y: number } {
  return (
    firstClickInWindow(clickPath, atMs, durationMs) ??
    sampleCursorPath(cursorPath, atMs) ?? { x: 0.5, y: 0.5 }
  );
}
