import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { CursorPathPoint } from './cursor-path';
import { sampleCursorPath } from './cursor-path';

/** Simulation step (ms) for the camera spring below -- same as cursor-path.ts's own SPRING_STEP_MS. */
const CAMERA_STEP_MS = 8;
/** Same slight underdamping as the cursor icon's own spring (see
 * cursor-path.ts's `DAMPING_RATIO`) -- a small, natural overshoot/settle on
 * direction changes reads as "alive", the way Screen Studio's camera motion
 * does, rather than a dead stop. */
const CAMERA_DAMPING_RATIO = 0.72;
/** Spring stiffness (1/s^2) for the camera catching up once triggered --
 * softer than even the cursor icon's own softest setting (`MIN_STIFFNESS` =
 * 18 in cursor-path.ts), since panning a whole zoomed viewport is a much
 * bigger motion than the glyph nudging a few pixels and needs a
 * proportionally slower, gentler glide to read as smooth rather than
 * jittery. */
const CAMERA_STIFFNESS = 16;
/**
 * Fraction of the zoomed viewport's own visible half-width/half-height the
 * cursor can wander within before the camera reacts at all -- e.g. 0.55
 * means the camera holds still until the cursor is more than 55% of the
 * way from center to the edge of what's currently visible. This is what
 * keeps the camera still while the cursor stays inside the visible zoomed
 * area, only moving when the cursor would otherwise near/leave frame --
 * not a camera that's always chasing the cursor around.
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
 * zoomed-in area -- i.e. only moving to keep the cursor in frame, not
 * continuously tracking it around inside a frame it's already comfortably
 * inside. Once moving, it's a damped spring easing toward the cursor (same
 * shape as the cursor icon's own `smoothCursorPath` spring, just softer),
 * so the catch-up itself glides rather than snapping.
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
    // continuously chasing every small movement.
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
/**
 * Cubic, not quadratic -- a noticeably snappier "fast then settles" feel for
 * the zoom scale itself. Quadratic's deceleration read as closer to linear
 * than a deliberate ease. `ease-out` (what zoom-in ramps mostly use) should
 * feel like it whips in and settles, not glide in evenly.
 */
export function easeZoom(t: number, easing: ZoomKeyframe['easing']): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t * t;
    case 'ease-out':
      return 1 - (1 - t) ** 3;
    case 'ease-in-out':
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
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
   * Zero whenever depth is 1 (not zoomed). Clamped (see `clampShiftAxis`)
   * so the scaled+shifted content never pulls back from covering its own
   * original bounds on either axis, regardless of how close `focal` is to
   * an edge -- video content is all there ever is past that edge (no
   * background necessarily behind it to show through instead).
   */
  shift: { x: number; y: number };
}

/**
 * The largest `shift` (in either direction, on one axis) that still leaves
 * the scaled content covering its own original bounds on that axis --
 * beyond this, the content's far edge pulls inward past where it started,
 * exposing whatever's behind it (nothing, once the background is off).
 * Derived from `result = focal + depth*(p-focal) + shift` (the resolved
 * position of local point `p`, `transform-origin` at `focal`, both 0-1
 * fractions of the content's own size -- matches PreviewStage.tsx's
 * `translate(shift%) scale(depth)` and effects/zoom.ts's pixel equivalent):
 * requiring `result(0) <= 0` and `result(1) >= 1` (the original [0,1] span
 * stays fully covered) solves to `-(1-focal)*(depth-1) <= shift <=
 * focal*(depth-1)`. At `depth === 1` (not zoomed) both bounds collapse to
 * 0, matching `shift` already being 0 there.
 */
function clampShiftAxis(rawShift: number, focal: number, depth: number): number {
  const max = focal * (depth - 1);
  const min = -(1 - focal) * (depth - 1);
  return Math.min(max, Math.max(min, rawShift));
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
  // Ramp-out is evaluated in its OWN forward-running progress (0 at the
  // start of the release, 1 at rest), not `easeZoom(remaining/rampMs, ...)`
  // directly -- that reads `easeZoom` backwards in time, which for the two
  // asymmetric curves (ease-in/ease-out) actually plays the *other* curve's
  // shape in real time (e.g. picking 'ease-out' gave a graceful zoom-in but
  // an abrupt slam-to-stop zoom-out). `1 - easeZoom(p, easing)` keeps the
  // chosen easing's own character -- fast burst then graceful settle for
  // 'ease-out', slow build then a snap for 'ease-in' -- consistent on both
  // the way in and the way out. For the point-symmetric curves ('linear',
  // 'ease-in-out') this is mathematically identical to the old formula, so
  // only ease-in/ease-out actually change.
  const envelope =
    rampMs <= 0
      ? 1
      : elapsed < rampMs
        ? easeZoom(elapsed / rampMs, active.easing)
        : remaining < rampMs
          ? 1 - easeZoom(1 - remaining / rampMs, active.easing)
          : 1;
  const depth = 1 + (active.depth - 1) * envelope;
  const focal =
    active.position === 'auto-cursor'
      ? (sampleCursorPath(autoZoomFocalPaths.get(active.id) ?? [], atMs) ?? { x: 0.5, y: 0.5 })
      : active.position;
  // Grows from 0 (rest) to envelope * distance-to-center at the zoom's peak,
  // so the focal point smoothly migrates to center as depth increases and
  // returns to its original spot as the zoom releases. Clamped per axis
  // (see clampShiftAxis) so a focal point near an edge can't drag the
  // content far enough to expose empty space past its own opposite edge.
  const shift = {
    x: clampShiftAxis(envelope * (0.5 - focal.x), focal.x, depth),
    y: clampShiftAxis(envelope * (0.5 - focal.y), focal.y, depth)
  };

  return { depth, focal, shift };
}
