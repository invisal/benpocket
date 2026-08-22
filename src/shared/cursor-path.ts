import type { CropRect } from '@screen-recorder/types/timeline';

/**
 * Cursor path smoothing/sampling, shared between the renderer (live editor
 * preview) and the main-process export compositor so both draw the exact
 * same trajectory. One sample of the recorded system cursor, normalized
 * (0-1) to the captured source's bounds.
 */
export interface CursorPathPoint {
  atMs: number;
  x: number;
  y: number;
}

/** Simulation step (ms) for the spring below -- fine enough that consumers'
 * linear interpolation between consecutive simulated points (see
 * `sampleCursorPath`) is visually indistinguishable from a continuous curve
 * at any plausible playback/export frame rate, without being so fine that a
 * long recording takes meaningfully longer to smooth. */
const SPRING_STEP_MS = 8;
/** Slight underdamping (< 1 = critically damped) gives a very small, natural
 * overshoot/settle on quick direction changes instead of a dead stop --
 * this is most of what makes spring-followed cursors read as "alive" rather
 * than just laggy, the way Screen Studio's cursor motion does. */
const DAMPING_RATIO = 0.72;
/** Spring stiffness bounds (1/s^2) the `smoothing` slider interpolates
 * between -- soft/slow-to-catch-up at `smoothing = 1`, snappy at ~0. */
const MIN_STIFFNESS = 18;
const MAX_STIFFNESS = 500;

/**
 * Spring-follow smoothing: simulates the cursor icon as a damped spring
 * chasing the raw recorded position, rather than just lagging behind it in a
 * straight line -- this is what gives the motion a natural ease-out/settle
 * feel instead of a robotic exponential decay. `smoothing` is 0 (off, path
 * returned untouched) - 1 (softest, slowest-to-catch-up spring).
 *
 * Walks the raw path once with an advancing index (not a fresh linear scan
 * per step) so smoothing a long recording stays fast: total work is
 * O(raw samples + simulation steps), not their product.
 */
export function smoothCursorPath(path: CursorPathPoint[], smoothing: number): CursorPathPoint[] {
  const amount = Math.min(Math.max(smoothing, 0), 1);
  if (path.length < 2 || amount <= 0) return path;

  const stiffness = MAX_STIFFNESS - amount * (MAX_STIFFNESS - MIN_STIFFNESS);
  const damping = DAMPING_RATIO * 2 * Math.sqrt(stiffness);
  const stepSec = SPRING_STEP_MS / 1000;

  const first = path[0];
  const last = path[path.length - 1];
  let x = first.x;
  let y = first.y;
  let vx = 0;
  let vy = 0;
  // Advances monotonically alongside `atMs` -- avoids re-scanning the raw
  // path from the start on every simulation step.
  let targetIndex = 0;

  const result: CursorPathPoint[] = [{ atMs: first.atMs, x, y }];
  for (let atMs = first.atMs + SPRING_STEP_MS; atMs < last.atMs; atMs += SPRING_STEP_MS) {
    while (targetIndex < path.length - 2 && path[targetIndex + 1].atMs < atMs) targetIndex++;
    const prev = path[targetIndex];
    const next = path[targetIndex + 1] ?? prev;
    const span = next.atMs - prev.atMs;
    const t = span > 0 ? (atMs - prev.atMs) / span : 0;
    const targetX = prev.x + (next.x - prev.x) * t;
    const targetY = prev.y + (next.y - prev.y) * t;

    // Semi-implicit (symplectic) Euler -- stable for this stiffness range at
    // an 8ms step, unlike explicit Euler.
    const ax = stiffness * (targetX - x) - damping * vx;
    const ay = stiffness * (targetY - y) - damping * vy;
    vx += ax * stepSec;
    vy += ay * stepSec;
    x += vx * stepSec;
    y += vy * stepSec;
    result.push({ atMs, x, y });
  }
  result.push({ atMs: last.atMs, x: last.x, y: last.y });
  return result;
}

/**
 * Linear interpolation of the (smoothed) path at a given timeline position.
 * Clamps to the first/last sample outside the recorded range. Returns null
 * only for an empty path -- callers should treat that as "no cursor to draw".
 *
 * Binary search for the bracketing pair (path is always sorted by `atMs`):
 * this is called every animation frame during playback/export against a
 * spring-simulated path that can be tens of thousands of points long for a
 * lengthy recording, so a linear scan from the start would get slower the
 * further into playback the cursor has moved.
 */
export function sampleCursorPath(
  path: CursorPathPoint[],
  atMs: number
): { x: number; y: number } | null {
  if (path.length === 0) return null;
  if (atMs <= path[0].atMs) return path[0];
  const last = path[path.length - 1];
  if (atMs >= last.atMs) return last;

  let lo = 0;
  let hi = path.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path[mid].atMs < atMs) lo = mid + 1;
    else hi = mid;
  }
  const next = path[lo];
  const prev = path[lo - 1];
  const span = next.atMs - prev.atMs;
  const t = span > 0 ? (atMs - prev.atMs) / span : 0;
  return { x: prev.x + (next.x - prev.x) * t, y: prev.y + (next.y - prev.y) * t };
}

/**
 * Remaps a whole cursor/click path from full-source-frame-normalized [0,1]
 * space (how it's captured -- see `CursorPathPoint`'s own doc) into
 * crop-relative [0,1] space -- i.e. what fraction of the *cropped* content
 * box each point falls at. Every consumer that positions something as a
 * percentage of the (possibly cropped) video box -- the cursor icon, click
 * ripples, `computeAutoZoomFocalPath`'s camera simulation -- needs points in
 * this space, not the raw captured one, or a crop shifts/scales the video
 * without the cursor/zoom following: a point near the original frame's edge
 * would still read as "near the edge" of the now-smaller cropped frame
 * instead of the (likely off-screen, if the crop excludes it) position it
 * actually belongs at. `crop === null` (no crop active) returns `path`
 * unchanged.
 */
export function remapPathToCropSpace(
  path: CursorPathPoint[],
  crop: CropRect | null
): CursorPathPoint[] {
  if (!crop || crop.width <= 0 || crop.height <= 0) return path;
  return path.map((p) => ({
    atMs: p.atMs,
    x: (p.x - crop.x) / crop.width,
    y: (p.y - crop.y) / crop.height
  }));
}

/** How long the click-bounce squash/pop icon animation lasts, in ms. */
const CLICK_BOUNCE_DURATION_MS = 320;
/** How long the expanding click ripple lasts, in ms -- longer than the icon
 * bounce so it reads as its own deliberate "a click happened here" signal,
 * not just part of the icon's motion. */
const CLICK_RIPPLE_DURATION_MS = 500;

/**
 * A click/resize-sample path is sorted and typically sparse (occasional
 * events, not a continuous sample stream like `cursorPath`), so this
 * binary-searches for the most recent one at/before `atMs` rather than
 * walking the whole array. Generic over anything timestamped (`clickPath`,
 * `WindowResizeSample[]`) -- same shape, same "most recent at/before"
 * question. Shared by `resolveClickBounceScale`, `resolveClickRipple`, and
 * `activeResizeSampleAt`.
 */
function mostRecentPointAtOrBefore<T extends { atMs: number }>(
  points: T[],
  atMs: number
): T | null {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].atMs <= atMs) lo = mid + 1;
    else hi = mid;
  }
  return points[lo - 1] ?? null;
}

/**
 * Cursor scale multiplier for the click-bounce effect at a given timeline
 * position -- a single smooth scale-in/scale-out pulse starting at the most
 * recent real mousedown, so the cursor visibly "presses" on click, the way
 * Screen Studio's does. `intensity` is 0-5 (see `CursorSettings.clickBounce`);
 * returns 1 (no effect) when there's no click within the animation window or
 * `intensity` is 0.
 *
 * Uses a raised-cosine (Hann) envelope rather than a damped oscillation --
 * `hann(p)` is 0 at both ends of the window *and* has zero slope there, so
 * the scale eases in from 1 with no snap at the click instant, smoothly
 * bottoms out at the halfway point, then eases back out to exactly 1 with no
 * snap at the window's end either. A previous version used a decaying
 * `cos(p * Math.PI * 3)` oscillation (squash, overshoot past 1, a couple of
 * quickly-decaying wobbles) -- punchier, but the extra wobbles read as
 * jittery rather than a clean press; this trades that for one smooth in/out
 * motion.
 *
 * Amplitude scales up to +-0.5 at max intensity (previously +-0.18) -- the
 * original range read as a barely-perceptible wobble, not something a
 * viewer could reliably notice as "a click just happened" the way this is
 * meant to communicate. Pair with `resolveClickRipple` below for a second,
 * unambiguous signal independent of the icon's own size.
 */
export function resolveClickBounceScale(
  clickPath: CursorPathPoint[],
  atMs: number,
  intensity: number
): number {
  if (intensity <= 0 || clickPath.length === 0) return 1;
  const click = mostRecentPointAtOrBefore(clickPath, atMs);
  if (!click) return 1;

  const elapsed = atMs - click.atMs;
  if (elapsed < 0 || elapsed > CLICK_BOUNCE_DURATION_MS) return 1;

  const p = elapsed / CLICK_BOUNCE_DURATION_MS;
  const amplitude = (Math.min(intensity, 5) / 5) * 0.5;
  const hann = (1 - Math.cos(p * Math.PI * 2)) / 2;
  return 1 - amplitude * hann;
}

export interface ClickRipple {
  /** Where the click actually happened (0-1, same normalized space as CursorPathPoint) -- the ring stays anchored here, not wherever the cursor has moved to since, so it stays an honest "a click happened *here*" marker even mid-pan. */
  pos: { x: number; y: number };
  /** 0 (just clicked) - 1 (fully expanded) -- multiply by whatever max ring radius the caller wants. */
  progress: number;
  /** 0 (invisible) - 1 (fully opaque at max intensity) -- already fades to 0 as `progress` approaches 1. */
  alpha: number;
}

/**
 * Expanding, fading ring centered on the most recent click -- an
 * unambiguous "a click happened here" signal independent of the cursor
 * icon's own squash/pop (`resolveClickBounceScale`), which alone was easy
 * to miss since it's just a size change on an already-small icon. Same
 * `intensity`/return-null convention as that function; callers turn
 * `progress` into an actual pixel radius (scaled against the cursor's own
 * size) and draw a stroked circle at `alpha` opacity.
 */
export function resolveClickRipple(
  clickPath: CursorPathPoint[],
  atMs: number,
  intensity: number
): ClickRipple | null {
  if (intensity <= 0 || clickPath.length === 0) return null;
  const click = mostRecentPointAtOrBefore(clickPath, atMs);
  if (!click) return null;

  const elapsed = atMs - click.atMs;
  if (elapsed < 0 || elapsed > CLICK_RIPPLE_DURATION_MS) return null;

  const linear = elapsed / CLICK_RIPPLE_DURATION_MS;
  // Expands fast at first and slows near the end (ease-out) rather than a
  // constant rate, closer to a real ripple/shockwave; fades in lockstep so
  // it's never a hard-edged ring popping in or out.
  const progress = 1 - (1 - linear) ** 2;
  const alpha = (1 - linear) * (Math.min(intensity, 5) / 5);
  return { pos: { x: click.x, y: click.y }, progress, alpha };
}

/** Which icon shape the cursor should draw -- the default arrow, a "hand" while hovering something clickable, a "resize" icon (at some `ResizeRotationDeg`) while the recorded window is actually being resized, or a "crosshair" ("+") icon while the OS is showing one -- e.g. a spreadsheet's fill-handle or column/row range-select drag (see `resolveCursorGesture`). */
export type CursorGesture = 'idle' | 'hover' | 'resize' | 'crosshair';

/**
 * The resize glyph is authored as a single horizontal double-headed arrow --
 * every orientation besides horizontal is this same artwork rotated in
 * place around its own hotspot, not separate art. 0/90/45/135 cover the 4
 * distinct orientations a symmetric double-headed arrow actually needs
 * (180 would look identical to 0, 225 identical to 45, etc).
 */
export type ResizeRotationDeg = 0 | 45 | 90 | 135;

/** Look-back window (ms) for "is the cursor still actively moving right now" -- also what distinguishes a plain hover (stationary) from movement. */
const STILLNESS_WINDOW_MS = 180;
/** Movement (normalized 0-1 units) across that window below which the cursor is considered stationary. */
const STILLNESS_EPS = 0.004;
/**
 * Radius (normalized 0-1 units) within which a resting position counts as
 * "near" some click -- roughly a small UI control and its immediate
 * surroundings. Bare stillness alone used to be enough to show "hover",
 * which meant the hand appeared over *any* pause anywhere on screen (an
 * empty desktop while narrating, a random spot mid-explanation) -- nothing
 * a real cursor does, since it only changes shape over an actual clickable
 * element. This is the proxy for "probably clickable" without any real
 * hit-testing.
 */
const HOVER_NEAR_CLICK_RADIUS = 0.035;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Whether the cursor was stationary (see `STILLNESS_WINDOW_MS`/`STILLNESS_EPS`) as of `atMs`. */
function isStillAt(path: CursorPathPoint[], atMs: number): boolean {
  const now = sampleCursorPath(path, atMs);
  const past = sampleCursorPath(path, atMs - STILLNESS_WINDOW_MS);
  if (!now || !past) return true;
  return distance(now, past) <= STILLNESS_EPS;
}

/**
 * A timestamp (ms since recording start) at which the tracked window's real
 * OS bounds were observed to have changed since the previous poll -- see
 * `WindowBoundsPoller` (main/screen-recorder/capture/window-bounds-poller.ts).
 * This is a *fact*, not an inference: the window's actual rect genuinely
 * moved/resized between two polls. Only ever populated for a window-source
 * recording with live bounds tracking -- always empty for a screen/
 * full-screen recording (there's no tracked window rect to diff), which is
 * exactly why `resolveCursorGesture` never shows 'resize' for one of those.
 *
 * This replaced an earlier heuristic that tried to infer "is this a resize
 * drag" from cursor movement + real mousedown/mouseup timestamps (`atMs` +
 * "moved far enough while the button was held"). That approach could never
 * reliably tell an actual window-edge drag apart from any other held-and-
 * moving gesture (a file drag, a text selection, a slider) -- every one of
 * those read as the same 'resize' icon, and tuning the movement threshold
 * either misfired on ordinary clicks/drags or missed real resizes. Diffing
 * the window's own polled bounds removes the guesswork entirely: it only
 * reflects an actual window-panel resize, nothing else drag-shaped.
 *
 * A second, independent producer feeds this same stream: `CursorShapeTracker`
 * (main/screen-recorder/capture/cursor-shape-tracker.ts) reports a real
 * sighting of the OS's own resize cursor -- the only signal that catches an
 * *internal* resize handle (a split-view divider, a panel splitter) inside
 * whatever's being recorded, since dragging one never changes the recorded
 * window's outer bounds at all, so `WindowBoundsPoller` alone can't see it.
 * That producer also knows the exact orientation (`rotationDeg`), since it
 * comes from the real cursor shape rather than a guess.
 */
export interface WindowResizeSample {
  atMs: number;
  /** Exact orientation from a real observed OS resize-cursor sighting (0 = horizontal, 90 = vertical) -- undefined for a sample that instead came from an observed whole-window bounds change (`WindowBoundsPoller`), which has no such direct signal and falls back to `resolveResizeRotationDeg`'s movement-direction heuristic instead. */
  rotationDeg?: 0 | 90;
}

/**
 * How long a real bounds-change stays "active" for gesture purposes after
 * the most recent one -- must exceed the poller's own poll interval (500ms)
 * so a continuous resize drag (whose bounds differ on essentially every
 * poll tick) never has a gap between samples, while a resize that has
 * genuinely stopped clears again shortly after polling confirms the bounds
 * are stable.
 */
const RESIZE_ACTIVE_WINDOW_MS = 700;

/** The most recent `WindowResizeSample` still within `RESIZE_ACTIVE_WINDOW_MS` of `atMs` -- resize is currently active exactly when this is non-null -- or null if resize isn't currently active. */
function activeResizeSampleAt(
  resizePath: WindowResizeSample[],
  atMs: number
): WindowResizeSample | null {
  const mostRecent = mostRecentPointAtOrBefore(resizePath, atMs);
  if (!mostRecent) return null;
  const elapsed = atMs - mostRecent.atMs;
  return elapsed >= 0 && elapsed <= RESIZE_ACTIVE_WINDOW_MS ? mostRecent : null;
}

/**
 * A timestamp (ms since recording start) at which the OS was observed
 * showing a crosshair/"plus" cursor -- e.g. the shape Excel/Google Sheets
 * show over a cell's fill-handle, or while dragging to range-select whole
 * columns/rows. Reported by the same producer as `WindowResizeSample`'s
 * cursor-shape half (`CursorShapeTracker`, main/screen-recorder/capture/
 * cursor-shape-tracker.ts) -- just a different recognized shape, macOS's
 * public `NSCursor.crosshair` / Windows' `IDC_CROSS`. Like resize, this is a
 * fact (the OS really is showing this cursor), not an inferred proxy.
 */
export interface CursorCrosshairSample {
  atMs: number;
}

/** Same reasoning/margin as `RESIZE_ACTIVE_WINDOW_MS` -- both are driven by the same ~50ms-cadence `CursorShapeTracker` stream. */
const CROSSHAIR_ACTIVE_WINDOW_MS = 700;

/** Whether the OS was observed showing a crosshair cursor recently enough to still count as active at `atMs` (see `CursorCrosshairSample`). */
function isCrosshairActiveAt(crosshairPath: CursorCrosshairSample[], atMs: number): boolean {
  const mostRecent = mostRecentPointAtOrBefore(crosshairPath, atMs);
  if (!mostRecent) return false;
  const elapsed = atMs - mostRecent.atMs;
  return elapsed >= 0 && elapsed <= CROSSHAIR_ACTIVE_WINDOW_MS;
}

/**
 * Whether `pos` sits near *any* click in the whole recording -- not just
 * ones before `atMs`. This runs at export/preview time over the complete,
 * already-recorded `clickPath`, so using a click that hasn't "happened yet"
 * relative to the current playhead is fair game (and correct): if the user
 * clicks this exact spot two seconds from now, it really was clickable right
 * now too, they just hadn't clicked it yet.
 */
function isNearAnyClick(clickPath: CursorPathPoint[], pos: { x: number; y: number }): boolean {
  for (const click of clickPath) {
    if (distance(pos, click) <= HOVER_NEAR_CLICK_RADIUS) return true;
  }
  return false;
}

/**
 * The exact, instantaneous "hover" condition at one single instant:
 * stationary, and resting near some click in the recording. See
 * `isHoverInstantAt` (below) for the debounced version actually used, and
 * `isHoverAt` for the version on top of *that* which adds a longer exit
 * linger.
 */
function isHoverStillAndNear(
  path: CursorPathPoint[],
  clickPath: CursorPathPoint[],
  atMs: number
): boolean {
  const pos = sampleCursorPath(path, atMs);
  if (!pos || !isStillAt(path, atMs)) return false;
  return isNearAnyClick(clickPath, pos);
}

/**
 * How long stillness must actually stop holding before hover's instantaneous
 * condition (`isHoverStillAndNear`) is allowed to flip off -- checking only
 * the single instant at `atMs` meant a one-frame jitter right at
 * `STILLNESS_EPS`'s boundary (natural hand tremor, especially with
 * `cursor.smoothing` at or near 0%) flipped the icon back and forth on every
 * tiny wobble, reading as a flicker rather than a clean switch. Entering
 * hover has no equivalent delay -- the hand should still appear the instant
 * the cursor actually settles, only leaving it is debounced.
 */
const HOVER_EXIT_CONFIRM_MS = 60;
/** Sampling step across `HOVER_EXIT_CONFIRM_MS` -- checks several points spanning the window, not just its two ends, so a brief pause in the middle can't cancel out against a big enough displacement at the edges. */
const HOVER_EXIT_CONFIRM_STEP_MS = 20;

/**
 * Debounced version of `isHoverStillAndNear`: true right now, or true at any
 * recently-sampled instant across `HOVER_EXIT_CONFIRM_MS` -- so a single
 * frame of jitter across the stillness boundary can't flip hover off by
 * itself, only genuinely-continuous movement can.
 */
function isHoverInstantAt(
  path: CursorPathPoint[],
  clickPath: CursorPathPoint[],
  atMs: number
): boolean {
  if (isHoverStillAndNear(path, clickPath, atMs)) return true;
  for (let t = atMs - HOVER_EXIT_CONFIRM_MS; t < atMs; t += HOVER_EXIT_CONFIRM_STEP_MS) {
    if (isHoverStillAndNear(path, clickPath, t)) return true;
  }
  return false;
}

/**
 * How long after any click hover can still show, even once the cursor is no
 * longer stationary at (or near) it -- so moving away from a clicked spot
 * doesn't snap straight back to the plain arrow. Restores this project's
 * original grace-period duration (a flat ~3.5s window after any click, from
 * before drag/resize detection existed) -- long enough to read as a
 * deliberate hold rather than an instant cut. Entering hover has no
 * equivalent delay -- the hand still appears the instant the cursor
 * actually settles, only leaving it is held.
 */
const HOVER_LINGER_MS = 3500;

/** Whether a click landed within `HOVER_LINGER_MS` at/before `atMs`. */
function isWithinHoverLinger(clickPath: CursorPathPoint[], atMs: number): boolean {
  const click = mostRecentPointAtOrBefore(clickPath, atMs);
  if (!click) return false;
  const elapsed = atMs - click.atMs;
  return elapsed >= 0 && elapsed <= HOVER_LINGER_MS;
}

/**
 * Whether `atMs` should show "hover" -- either right now (`isHoverInstantAt`),
 * or within `HOVER_LINGER_MS` of any click (`isWithinHoverLinger`), see that
 * constant's own doc for why leaving hover is deliberately softer than
 * entering it. A single binary-search lookup either way, not a scan -- cheap
 * regardless of how long the grace window is, unlike re-checking
 * `isHoverInstantAt` at many past instants would be over several seconds.
 */
function isHoverAt(path: CursorPathPoint[], clickPath: CursorPathPoint[], atMs: number): boolean {
  return isHoverInstantAt(path, clickPath, atMs) || isWithinHoverLinger(clickPath, atMs);
}

/**
 * Which way the resize icon should point during a drag, derived from the
 * cursor's own actual recent direction of travel rather than a fixed
 * default: `atan2` of the movement vector over the same
 * `STILLNESS_WINDOW_MS` lookback `isStillAt` already uses, folded into
 * 0-180° (a double-headed arrow looks identical rotated 180°) and snapped to
 * the nearest of the 4 orientations the artwork actually has (see
 * `ResizeRotationDeg`). Callers only call this once the resize gesture is
 * already active, so there's always real recent movement to read a
 * direction from.
 */
export function resolveResizeRotationDeg(path: CursorPathPoint[], atMs: number): ResizeRotationDeg {
  const now = sampleCursorPath(path, atMs);
  const past = sampleCursorPath(path, atMs - STILLNESS_WINDOW_MS);
  if (!now || !past) return 0;
  const dx = now.x - past.x;
  const dy = now.y - past.y;
  if (dx === 0 && dy === 0) return 0;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const folded = ((angleDeg % 180) + 180) % 180;
  const snapped = (Math.round(folded / 45) * 45) % 180;
  return snapped as ResizeRotationDeg;
}

/**
 * Which way the resize icon should point at `atMs`: prefers the exact
 * orientation from a real observed OS resize-cursor sighting
 * (`WindowResizeSample.rotationDeg`, see `CursorShapeTracker`) when the
 * currently-active resize sample carries one, since that's a fact rather
 * than a guess; falls back to the cursor's own recent movement direction
 * (`resolveResizeRotationDeg`) when it doesn't -- the case for a whole-
 * window corner drag (`WindowBoundsPoller`), which has no such direct
 * signal.
 */
export function resolveActiveResizeRotationDeg(
  path: CursorPathPoint[],
  resizePath: WindowResizeSample[],
  atMs: number
): ResizeRotationDeg {
  const active = activeResizeSampleAt(resizePath, atMs);
  if (active?.rotationDeg !== undefined) return active.rotationDeg;
  return resolveResizeRotationDeg(path, atMs);
}

/**
 * Infers which icon shape to draw at `atMs` from the recording's own data:
 * continuous cursor position, real mousedown timestamps, and (for a
 * window-source recording only) real observed window-bounds/cursor-shape
 * changes. There's still no accessibility/DOM introspection of whatever was
 * recorded, so there's no signal for "is this pixel actually something
 * clickable" -- but "is the tracked window's rect actually changing right
 * now, or is the OS itself showing a resize cursor" is a real fact
 * (`activeResizeSampleAt`), not a proxy:
 *
 * - "resize": an active `WindowResizeSample` exists (`activeResizeSampleAt`)
 *   -- `resizePath` only ever has entries for a window-source recording
 *   with live bounds tracking, so this never fires for a screen/full-screen
 *   recording. Always on (no setting disables it, unlike hover below) --
 *   it's a real, factual signal rather than an inferred proxy, so there's
 *   nothing to opt out of. Takes precedence over everything else -- a real
 *   resize is happening regardless of what's rendered beneath.
 * - "crosshair": an active `CursorCrosshairSample` exists
 *   (`isCrosshairActiveAt`) -- the OS was just observed showing a
 *   crosshair/"plus" cursor (a spreadsheet fill-handle, a column/row
 *   range-select drag). Same "real fact, always on" reasoning as resize;
 *   takes precedence over hover for the same reason.
 * - "hover": `handGestureEnabled` on, stationary, and resting near some click
 *   anywhere in the recording (`isHoverAt`/`HOVER_NEAR_CLICK_RADIUS`). Also
 *   holds for a full grace window (`HOVER_LINGER_MS`) after any click, even
 *   once the cursor has moved away from it, rather than snapping straight
 *   back to idle.
 * - "idle": none of the above -- the plain arrow.
 *
 * `path` should be the same (smoothed) trajectory `sampleCursorPath` draws
 * the cursor from, so the gesture never disagrees with where the icon
 * actually is.
 */
export function resolveCursorGesture(
  path: CursorPathPoint[],
  clickPath: CursorPathPoint[],
  resizePath: WindowResizeSample[],
  crosshairPath: CursorCrosshairSample[],
  atMs: number,
  handGestureEnabled = true
): CursorGesture {
  const now = sampleCursorPath(path, atMs);
  if (!now) return 'idle';

  if (activeResizeSampleAt(resizePath, atMs) !== null) return 'resize';
  if (isCrosshairActiveAt(crosshairPath, atMs)) return 'crosshair';
  if (handGestureEnabled && isHoverAt(path, clickPath, atMs)) return 'hover';
  return 'idle';
}
