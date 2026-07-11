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

/** How long the click-bounce squash/settle animation lasts, in ms. */
const CLICK_BOUNCE_DURATION_MS = 260;

/**
 * Cursor scale multiplier for the click-bounce effect at a given timeline
 * position -- a quick squash-and-settle (damped oscillation) starting at the
 * most recent real mousedown, so the cursor visibly "presses" on click, the
 * way Screen Studio's does. `intensity` is 0-5 (see `CursorSettings.
 * clickBounce`); returns 1 (no effect) when there's no click within the
 * animation window or `intensity` is 0.
 *
 * `clickPath` is sorted and typically sparse (occasional clicks, not a
 * continuous sample stream like `cursorPath`), so this binary-searches for
 * the most recent click rather than walking the whole array.
 */
export function resolveClickBounceScale(
  clickPath: CursorPathPoint[],
  atMs: number,
  intensity: number
): number {
  if (intensity <= 0 || clickPath.length === 0) return 1;

  let lo = 0;
  let hi = clickPath.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clickPath[mid].atMs <= atMs) lo = mid + 1;
    else hi = mid;
  }
  const click = clickPath[lo - 1];
  if (!click) return 1;

  const elapsed = atMs - click.atMs;
  if (elapsed < 0 || elapsed > CLICK_BOUNCE_DURATION_MS) return 1;

  // A damped cosine: squashes immediately on click (p=0), then a couple of
  // decaying overshoots settling back to 1 by the end of the window.
  const p = elapsed / CLICK_BOUNCE_DURATION_MS;
  const amplitude = (Math.min(intensity, 5) / 5) * 0.18;
  return 1 - amplitude * Math.exp(-p * 6) * Math.cos(p * Math.PI * 3);
}
