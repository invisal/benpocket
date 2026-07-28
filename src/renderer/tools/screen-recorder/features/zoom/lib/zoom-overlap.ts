import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import { ZOOM_MIN_DURATION_MS } from '@shared/constants';

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
 *
 * There's deliberately no fixed *maximum* duration -- a zoom keyframe can
 * run as long as the actual footage allows, not an arbitrary cap. The only
 * ceilings are real ones: the next keyframe's own start, or (when there is
 * no next keyframe) `sourceDurationMs`, the recording's actual length --
 * defaults to `Infinity` for callers that don't have that figure handy and
 * don't need it (auto-generated keyframes always start at a few seconds,
 * far under any real recording's length; only a later manual resize can
 * grow one long enough for this to matter, and every resize path does pass
 * the real value -- see ZoomTrack.tsx/ZoomKeyframeEditor.tsx).
 */
export function clampToNonOverlapping(
  keyframes: ZoomKeyframe[],
  excludeId: string | null,
  desiredAtMs: number,
  desiredDurationMs: number,
  sourceDurationMs = Infinity
): { atMs: number; durationMs: number } {
  const others = keyframes.filter((k) => k.id !== excludeId).sort((a, b) => a.atMs - b.atMs);

  let nextIdx = others.findIndex((o) => o.atMs >= desiredAtMs);
  if (nextIdx === -1) nextIdx = others.length;
  const prev = others[nextIdx - 1] ?? null;
  const next = others[nextIdx] ?? null;

  const lowerBound = prev ? prev.atMs + prev.durationMs : 0;
  const upperBound = next ? next.atMs : sourceDurationMs;

  const atMs = Math.max(lowerBound, Math.min(desiredAtMs, upperBound));
  const maxGapMs = Math.max(0, upperBound - atMs);
  // A floor first, then a cap to whatever room is actually available --
  // that cap only ever shrinks further, and only bites when neighbors (or
  // the recording's own end) leave less room than ZOOM_MIN_DURATION_MS (no
  // valid non-overlapping slot exists at the usual minimum, so "never
  // overlap"/"never run past the footage" wins over "always >= minimum").
  const durationMs = Math.min(Math.max(desiredDurationMs, ZOOM_MIN_DURATION_MS), maxGapMs);

  return { atMs, durationMs };
}
