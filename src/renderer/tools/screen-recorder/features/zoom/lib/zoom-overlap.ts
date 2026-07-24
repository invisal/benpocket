import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import { ZOOM_MIN_DURATION_MS, ZOOM_MAX_DURATION_MS } from '@shared/constants';

/**
 * Clamps a candidate `[atMs, atMs + durationMs)` window so it never
 * overlaps any other keyframe's range -- `resolveZoom` (shared verbatim by
 * the live preview and the export compositor, see zoom-resolve.ts) picks
 * whichever keyframe's range contains a given moment via a plain `.find`,
 * so an overlap would make that pick order-dependent and effectively
 * undefined rather than just a cosmetic timeline glitch. `excludeId` is the
 * keyframe being moved/resized/extended (`null` when adding a new one), so
 * it never collides with itself.
 *
 * Shared by manual placement (zoom-store.ts's `addKeyframe`/`updateKeyframe`)
 * and auto-generation (auto-zoom-engine.ts) -- both need the exact same
 * non-overlap guarantee, so there's one place that enforces it rather than
 * each path relying on its own math staying correct.
 *
 * Finds the nearest existing keyframe ending at/before the desired start
 * and the nearest one starting at/after it -- those bound the free gap the
 * window has to fit into. If the desired start already falls inside
 * another keyframe's range, it snaps forward to just past that keyframe's
 * end (simple, deterministic "push after" resolution rather than trying to
 * guess drag direction).
 */
export function clampToNonOverlapping(
  keyframes: ZoomKeyframe[],
  excludeId: string | null,
  desiredAtMs: number,
  desiredDurationMs: number
): { atMs: number; durationMs: number } {
  const others = keyframes.filter((k) => k.id !== excludeId).sort((a, b) => a.atMs - b.atMs);

  let nextIdx = others.findIndex((o) => o.atMs >= desiredAtMs);
  if (nextIdx === -1) nextIdx = others.length;
  const prev = others[nextIdx - 1] ?? null;
  const next = others[nextIdx] ?? null;

  const lowerBound = prev ? prev.atMs + prev.durationMs : 0;
  const upperBound = next ? next.atMs : Infinity;

  const atMs = Math.max(lowerBound, Math.min(desiredAtMs, upperBound));
  const maxGapMs = Math.max(0, upperBound - atMs);
  // Normal [MIN, MAX] bounds first, then a further cap to whatever the gap
  // actually allows -- that second cap can only ever shrink further, and
  // only bites in the rare case where neighbors are packed tighter than
  // ZOOM_MIN_DURATION_MS apart (no valid non-overlapping slot exists at
  // the usual minimum, so "never overlap" wins over "always >= minimum").
  const durationMs = Math.min(
    Math.max(desiredDurationMs, ZOOM_MIN_DURATION_MS),
    ZOOM_MAX_DURATION_MS,
    maxGapMs
  );

  return { atMs, durationMs };
}
