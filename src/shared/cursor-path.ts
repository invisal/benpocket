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

/** How long the click-bounce squash/pop icon animation lasts, in ms. */
const CLICK_BOUNCE_DURATION_MS = 320;
/** How long the expanding click ripple lasts, in ms -- longer than the icon
 * bounce so it reads as its own deliberate "a click happened here" signal,
 * not just part of the icon's motion. */
const CLICK_RIPPLE_DURATION_MS = 500;

/**
 * `clickPath` is sorted and typically sparse (occasional clicks, not a
 * continuous sample stream like `cursorPath`), so this binary-searches for
 * the most recent click at/before `atMs` rather than walking the whole
 * array. Shared by `resolveClickBounceScale` and `resolveClickRipple` --
 * both animations key off the exact same "most recent click" moment.
 */
function mostRecentClick(clickPath: CursorPathPoint[], atMs: number): CursorPathPoint | null {
  let lo = 0;
  let hi = clickPath.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clickPath[mid].atMs <= atMs) lo = mid + 1;
    else hi = mid;
  }
  return clickPath[lo - 1] ?? null;
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
  const click = mostRecentClick(clickPath, atMs);
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
  const click = mostRecentClick(clickPath, atMs);
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

/** Which icon shape the cursor should draw -- the default arrow, or a "hand" while hovering still or dragging (both read the same visually -- there's no separate grab glyph). */
export type CursorGesture = 'idle' | 'hover';

/** Upper bound on how long after a click its own movement can still count as
 * "that click's drag" -- past this, the click is treated as long since
 * resolved (pressed and released) even if the cursor keeps moving, so one
 * old click can't keep claiming unrelated movement minutes later as "still
 * dragging that". Drag-like movement doesn't get its own icon (see
 * `CursorGesture`) -- it's just another reason `resolveCursorGesture` keeps
 * showing "hover" instead of falling back to idle. */
const DRAG_MAX_WINDOW_MS = 4000;
/** Minimum drift from the click's own position (normalized 0-1 units) before movement counts as an actual drag rather than a stationary click's natural jitter. */
const DRAG_DISTANCE_THRESHOLD = 0.015;
/** Look-back window (ms) for "is the cursor still actively moving right now" -- also what distinguishes a plain hover (stationary) from movement. */
const STILLNESS_WINDOW_MS = 180;
/** Movement (normalized 0-1 units) across that window below which the cursor is considered stationary. */
const STILLNESS_EPS = 0.004;
/**
 * How long movement must hold *continuously* before the icon actually
 * leaves "hover" for idle/drag -- checking only the single instant at `atMs`
 * meant a one-frame jitter right at the stillness boundary flipped the icon
 * back and forth on every tiny wobble, reading as a flicker rather than a
 * clean switch. Entering "hover" has no equivalent delay -- the hand should
 * still appear the instant the cursor actually settles, only leaving it
 * is debounced.
 */
const HOVER_EXIT_CONFIRM_MS = 60;
/** Sampling step across `HOVER_EXIT_CONFIRM_MS` -- checks several points spanning the window, not just its two ends, so a brief pause in the middle can't cancel out against a big enough displacement at the edges. */
const HOVER_EXIT_CONFIRM_STEP_MS = 20;
/**
 * How long after a click the icon keeps holding "hover" through subsequent
 * movement that isn't a drag -- e.g. clicking through a row of tightly
 * packed buttons (A, then sweeping the cursor over to B, C, D) shouldn't
 * flicker the icon back to idle for the moment spent traveling between
 * each one. Much longer than `HOVER_EXIT_CONFIRM_MS`, which only smooths a
 * single frame of jitter, not several seconds of "still clicking around in
 * the same cluster of controls."
 */
const HOVER_CLICK_GRACE_MS = 3500;
/**
 * Radius (normalized 0-1 units) within which a resting position counts as
 * "near" some click -- roughly a small UI control and its immediate
 * surroundings. Bare stillness alone used to be enough to show "hover",
 * which meant the hand appeared over *any* pause anywhere on screen (an
 * empty desktop while narrating, a random spot mid-explanation) -- nothing
 * a real cursor does, since it only changes shape over an actual clickable
 * element. This is the other proxy (alongside `HOVER_CLICK_GRACE_MS`) for
 * "probably clickable" without any real hit-testing.
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

/** Whether a click landed within `HOVER_CLICK_GRACE_MS` at/before `atMs`. */
function isWithinClickGrace(clickPath: CursorPathPoint[], atMs: number): boolean {
  const click = mostRecentClick(clickPath, atMs);
  if (!click) return false;
  const elapsed = atMs - click.atMs;
  return elapsed >= 0 && elapsed <= HOVER_CLICK_GRACE_MS;
}

/** Whether `atMs` should show "hover": stationary, *and* either resting near some click in the recording or within a recent click's grace window -- see `resolveCursorGesture`'s own doc for why bare stillness alone isn't enough. */
function isHoverAt(path: CursorPathPoint[], clickPath: CursorPathPoint[], atMs: number): boolean {
  const pos = sampleCursorPath(path, atMs);
  if (!pos || !isStillAt(path, atMs)) return false;
  return isNearAnyClick(clickPath, pos) || isWithinClickGrace(clickPath, atMs);
}

/** Whether `atMs` is mid-drag: moving, displaced from the most recent click's own position beyond `DRAG_DISTANCE_THRESHOLD`, within `DRAG_MAX_WINDOW_MS` of it. */
function isDragAt(path: CursorPathPoint[], clickPath: CursorPathPoint[], atMs: number): boolean {
  const now = sampleCursorPath(path, atMs);
  if (!now) return false;
  const click = mostRecentClick(clickPath, atMs);
  if (!click) return false;
  const elapsed = atMs - click.atMs;
  if (elapsed < 0 || elapsed > DRAG_MAX_WINDOW_MS) return false;
  return distance(now, click) > DRAG_DISTANCE_THRESHOLD;
}

/**
 * Infers which icon shape to draw at `atMs` from the recording's own data --
 * continuous cursor position plus real mousedown timestamps. There's no
 * accessibility/DOM introspection of whatever was recorded and no mouseup
 * capture (see `ClickTracker` in main/screen-recorder/capture/click-tracker.
 * ts), so there's no real signal for "is this pixel actually something
 * clickable" -- every non-idle state here is a proxy, not an observation:
 *
 * - "hover": stationary, and either resting near some click anywhere in the
 *   recording (`HOVER_NEAR_CLICK_RADIUS`) or within a recent click's grace
 *   window (`HOVER_CLICK_GRACE_MS`) -- see `isHoverAt`. Bare stillness used
 *   to be enough on its own, which made the hand appear over any pause
 *   anywhere, not just plausibly-clickable spots. Appears the instant the
 *   cursor settles, but (`HOVER_EXIT_CONFIRM_MS`) lingers a little after
 *   movement resumes rather than dropping on the very first frame of
 *   motion -- OR moving in a drag-like way (`isDragAt`: displaced from the
 *   most recent click's own position beyond `DRAG_DISTANCE_THRESHOLD`,
 *   within `DRAG_MAX_WINDOW_MS` of it), which reads as the same "hover"
 *   rather than a separate icon -- there's only the one hand glyph. A brief
 *   pause mid-drag (natural hand tremor while dragging carefully) is
 *   likewise checked before falling back to idle, so it doesn't flicker.
 * - "idle": none of the above -- the plain arrow.
 *
 * `path` should be the same (smoothed) trajectory `sampleCursorPath` draws
 * the cursor from, so the gesture never disagrees with where the icon
 * actually is.
 */
export function resolveCursorGesture(
  path: CursorPathPoint[],
  clickPath: CursorPathPoint[],
  atMs: number
): CursorGesture {
  const now = sampleCursorPath(path, atMs);
  if (!now) return 'idle';

  if (isStillAt(path, atMs)) {
    // Was this drag-like movement up until just now, rather than a genuine
    // release? Checked before settling into idle so a momentary pause
    // mid-drag doesn't drop the hand.
    for (let t = atMs - HOVER_EXIT_CONFIRM_MS; t < atMs; t += HOVER_EXIT_CONFIRM_STEP_MS) {
      if (isDragAt(path, clickPath, t)) return 'hover';
    }
    return isHoverAt(path, clickPath, atMs) ? 'hover' : 'idle';
  }

  // Moving right now, but don't leave "hover" over a single frame of
  // motion -- only once movement has held continuously across the whole
  // confirm window (checked at several points across it, not just the
  // ends) does the icon actually switch, damping the flicker a momentary
  // jitter right at the stillness boundary used to cause.
  for (let t = atMs - HOVER_EXIT_CONFIRM_MS; t < atMs; t += HOVER_EXIT_CONFIRM_STEP_MS) {
    if (isHoverAt(path, clickPath, t)) return 'hover';
  }

  if (isDragAt(path, clickPath, atMs)) return 'hover';
  return isWithinClickGrace(clickPath, atMs) ? 'hover' : 'idle';
}
