import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { CursorPathPoint } from './cursor-path';
import { sampleCursorPath } from './cursor-path';

/** Simulation step (ms) for the camera spring below -- same reasoning as cursor-path.ts's own SPRING_STEP_MS. */
const CAMERA_STEP_MS = 8;
/** Close to critically damped (1 = critically damped) -- once the camera
 * actually starts moving, it should ease to a stop at the new hold point
 * without the cursor icon's own small deliberate overshoot; overshooting a
 * whole zoomed viewport's pan would read as a mistake, not "alive". */
const CAMERA_DAMPING_RATIO = 0.92;
/** Spring stiffness (1/s^2) for the camera catching up once triggered --
 * fixed, not user-tunable (unlike cursor-icon smoothing); a best-effort
 * starting point pending real playback feedback, see this function's own
 * doc. */
const CAMERA_STIFFNESS = 55;
/**
 * Fraction of the zoomed viewport's own visible half-width/half-height the
 * cursor can wander within before the camera reacts at all -- e.g. 0.55
 * means the camera holds still until the cursor is more than 55% of the
 * way from center to the edge of what's currently visible.
 */
const CAMERA_DEADZONE_FRACTION = 0.55;
/**
 * Hard ceiling on how many steps a single keyframe's simulation will ever
 * run, regardless of its `durationMs` -- 200,000 * CAMERA_STEP_MS covers
 * ~26 minutes at full native resolution, comfortably past any real keyframe
 * window. Without this, a keyframe long enough (now possible now that zoom
 * keyframes aren't capped at a fixed 10s -- see ZOOM_MIN_DURATION_MS's own
 * doc) turns this into a synchronous loop that runs for as long as the
 * keyframe itself, pushing one sample into an ever-growing array per step;
 * a pathological/corrupted `durationMs` (e.g. `Infinity`) made this loop
 * genuinely never terminate, blocking export before a single frame decodes
 * (confirmed: it OOM-crashes the process rather than merely running long).
 * Past this ceiling the step is widened so the total sample count stays
 * fixed -- coarser resolution for an extreme-length window instead of
 * unbounded time/memory.
 */
const MAX_CAMERA_SAMPLES = 200_000;

/**
 * Simulates the auto-zoom camera's focal point across one keyframe's own
 * window: holds perfectly still while the recorded cursor stays within a
 * deadzone of the current hold point (scaled to how much the keyframe's
 * own `depth` actually leaves visible -- deeper zoom means a smaller
 * deadzone in absolute screen-fraction terms), and only eases toward the
 * cursor once it drifts far enough to approach the edge of the visible,
 * zoomed-in area. This is what stops auto-zoom from re-centering on every
 * small movement or every click -- the camera only pans when the cursor
 * would otherwise go out of (or near the edge of) view, then holds again
 * once it's caught up, rather than continuously tracking raw cursor
 * position for the keyframe's whole duration.
 *
 * A best-effort tuning (`CAMERA_STIFFNESS`/`CAMERA_DAMPING_RATIO`/
 * `CAMERA_DEADZONE_FRACTION` above) -- there's no way to A/B this against
 * real playback feel from here, so treat the constants as a starting point
 * to adjust from real feedback, not a finished result.
 *
 * Returns one path per keyframe (not one shared global path) since the
 * deadzone size depends on that keyframe's own zoom depth -- see every
 * caller's own `autoZoomFocalPaths` map, keyed by keyframe id.
 */
export function computeAutoZoomFocalPath(
  cursorPath: CursorPathPoint[],
  keyframe: ZoomKeyframe
): CursorPathPoint[] {
  const startMs = keyframe.atMs;
  // Guards against a non-finite/negative durationMs (e.g. a corrupted
  // Infinity/NaN slipping in from somewhere upstream) turning this into an
  // infinite loop -- see MAX_CAMERA_SAMPLES's own doc for why this matters.
  const durationMs = Number.isFinite(keyframe.durationMs) ? Math.max(0, keyframe.durationMs) : 0;
  const endMs = startMs + durationMs;
  if (cursorPath.length === 0 || durationMs === 0) return [];

  const deadzoneHalfWidth = (0.5 * CAMERA_DEADZONE_FRACTION) / keyframe.depth;
  const deadzoneHalfHeight = (0.5 * CAMERA_DEADZONE_FRACTION) / keyframe.depth;
  const damping = CAMERA_DAMPING_RATIO * 2 * Math.sqrt(CAMERA_STIFFNESS);
  // Widens the step past MAX_CAMERA_SAMPLES so total iterations/samples stay
  // bounded no matter how long the window is -- unchanged (CAMERA_STEP_MS)
  // for every realistic keyframe length.
  const stepMs = Math.max(CAMERA_STEP_MS, durationMs / MAX_CAMERA_SAMPLES);
  const stepSec = stepMs / 1000;

  const initial = sampleCursorPath(cursorPath, startMs) ?? { x: 0.5, y: 0.5 };
  let x = initial.x;
  let y = initial.y;
  let vx = 0;
  let vy = 0;

  const result: CursorPathPoint[] = [{ atMs: startMs, x, y }];
  for (let atMs = startMs + stepMs; atMs <= endMs; atMs += stepMs) {
    const cursor = sampleCursorPath(cursorPath, atMs) ?? { x, y };
    const dx = cursor.x - x;
    const dy = cursor.y - y;
    // Target the camera's *own current position* (i.e. don't move) unless
    // the cursor has drifted outside the deadzone on that axis -- the
    // spring only ever engages once actually needed, rather than
    // continuously chasing every small movement or every new click.
    const targetX = Math.abs(dx) > deadzoneHalfWidth ? cursor.x : x;
    const targetY = Math.abs(dy) > deadzoneHalfHeight ? cursor.y : y;

    // Semi-implicit (symplectic) Euler -- see cursor-path.ts's own spring
    // for why this integration order is what keeps it stable at this step size.
    const ax = CAMERA_STIFFNESS * (targetX - x) - damping * vx;
    const ay = CAMERA_STIFFNESS * (targetY - y) - damping * vy;
    vx += ax * stepSec;
    vy += ay * stepSec;
    x += vx * stepSec;
    y += vy * stepSec;
    result.push({ atMs, x, y });
  }
  return result;
}

/**
 * Resolves the current zoom depth/focal point at `atMs`, shared between the
 * live editor preview (PreviewStage.tsx, CSS transform) and the export
 * compositor (frame-compositor.ts, canvas transform) so both zoom
 * identically -- what you see while editing is what gets exported.
 */
export function easeZoom(t: number, easing: ZoomKeyframe['easing']): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
}

export interface ResolvedZoom {
  depth: number;
  /** Pivot for `scale(depth)` (0-1, normalized) -- e.g. CSS `transform-origin`, or the anchor point in a canvas translate/scale/translate-back. Scaling alone around this point holds it fixed on screen. */
  focal: { x: number; y: number };
  /**
   * Extra translate (0-1, fraction of the content's own size) layered on
   * top of the focal-anchored scale. Scaling around a fixed point keeps
   * that point pinned wherever it originally was on screen (e.g. still
   * near the top if you clicked near the top) -- `shift` gradually drags
   * it toward the center of the frame as the zoom deepens instead, which
   * is what makes a "zoom to this point" read as actually zooming *in on*
   * the point rather than just growing everything around a fixed pin.
   * Zero whenever depth is 1 (not zoomed).
   */
  shift: { x: number; y: number };
}

/**
 * `'auto-cursor'` keyframes track the *real* recorded cursor path via a
 * per-keyframe deadzone-camera simulation (see `computeAutoZoomFocalPath`)
 * rather than a fixed point -- this is what makes auto-zoom actually
 * follow the mouse while zoomed in, instead of zooming into a single
 * frozen spot, while still holding still for small movements instead of
 * continuously re-centering. Falls back to a fixed center point if there's
 * no cursor data (e.g. a 'window' capture, which never gets a cursor path
 * -- see cursor-tracker.ts). Manually placed keyframes (`position: {x, y}`,
 * set by clicking the preview while positioning is armed, or via the
 * "Fix to First Click" context menu item) always use that exact fixed
 * point.
 *
 * `autoZoomFocalPaths` must hold one precomputed `computeAutoZoomFocalPath`
 * result per `'auto-cursor'` keyframe, keyed by that keyframe's own id --
 * every caller computes this once (smoothing/simulation doesn't depend on
 * `atMs`), not per frame. Manually-positioned keyframes need no entry.
 */
export function resolveZoom(
  atMs: number,
  keyframes: ZoomKeyframe[],
  autoZoomFocalPaths: Map<string, CursorPathPoint[]> = new Map()
): ResolvedZoom {
  const identity: ResolvedZoom = { depth: 1, focal: { x: 0.5, y: 0.5 }, shift: { x: 0, y: 0 } };
  const active = keyframes.find(
    (k) => k.enabled && atMs >= k.atMs && atMs <= k.atMs + k.durationMs
  );
  if (!active) return identity;

  // Per-keyframe: how long the ease-in/ease-out either side of the hold
  // takes (see ZoomKeyframeEditor's "Hold transition" slider). Keyframes
  // shorter than 2x this scale the ramps down instead of overlapping,
  // degrading to a plain ease-in-then-out with no hold.
  const rampMs = Math.min(active.holdTransitionMs, active.durationMs / 2);
  const elapsed = atMs - active.atMs;
  const remaining = active.durationMs - elapsed;
  const envelope =
    rampMs <= 0
      ? 1
      : elapsed < rampMs
        ? easeZoom(elapsed / rampMs, active.easing)
        : remaining < rampMs
          ? easeZoom(remaining / rampMs, active.easing)
          : 1;
  const depth = 1 + (active.depth - 1) * envelope;
  const focal =
    active.position === 'auto-cursor'
      ? (sampleCursorPath(autoZoomFocalPaths.get(active.id) ?? [], atMs) ?? { x: 0.5, y: 0.5 })
      : active.position;
  // Grows from 0 (rest) to envelope * distance-to-center at the zoom's peak,
  // so the focal point smoothly migrates to center as depth increases and
  // returns to its original spot as the zoom releases.
  const shift = { x: envelope * (0.5 - focal.x), y: envelope * (0.5 - focal.y) };

  return { depth, focal, shift };
}
