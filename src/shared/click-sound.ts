import type { CursorPathPoint } from './cursor-path';

/**
 * Click-sound PCM mixing, shared between the renderer (live editor preview,
 * played via `AudioContext`) and the export audio pipeline
 * (`audio-encoder.ts`, which mixes the same burst directly into decoded PCM
 * before re-encoding). Deliberately decoupled from *where* the burst
 * waveform comes from -- both sides decode the same bundled asset (see
 * `features/cursor/lib/click-sound-asset.ts`) at their own required sample
 * rate, then hand the resulting `Float32Array` in here.
 */

/**
 * Maps the 0-5 intensity convention (`CursorSettings.clickBounce`, reused
 * here rather than adding a second slider) onto a 0-1 gain.
 */
export function intensityToGain(intensity: number): number {
  return Math.min(Math.max(intensity, 0), 5) / 5;
}

/** Returns `burst` scaled by `gain` -- `burst` itself is left untouched. */
export function scaleBurst(burst: Float32Array, gain: number): Float32Array {
  if (gain === 1) return burst;
  const scaled = new Float32Array(burst.length);
  for (let i = 0; i < burst.length; i++) scaled[i] = burst[i] * gain;
  return scaled;
}

/**
 * Additively mixes `burst` into `target` starting at `offsetFrames`,
 * clamping the sum to [-1, 1] so overlapping/back-to-back clicks can't wrap
 * past digital full scale. `offsetFrames` (and `offsetFrames + burst.length`)
 * may fall partially or fully outside `target`'s bounds -- only the
 * overlapping portion is applied.
 */
export function mixBurstInto(
  target: Float32Array,
  burst: Float32Array,
  offsetFrames: number
): void {
  const start = Math.max(0, offsetFrames);
  const end = Math.min(target.length, offsetFrames + burst.length);
  for (let i = start; i < end; i++) {
    const sum = target[i] + burst[i - offsetFrames];
    target[i] = Math.min(1, Math.max(-1, sum));
  }
}

/**
 * Every recorded click's elapsed time (seconds) since `rangeStartMs`, for
 * clicks that fall within `[rangeStartMs, rangeEndMs)`. Shared selection
 * logic between the live preview (whole-project time, `speed` always 1) and
 * the export audio pipeline (per-segment local time, `speed`-adjusted so a
 * 2x-speed clip's clicks land twice as close together in output time; see
 * `audio-encoder.ts`).
 */
export function clickElapsedSecondsInRange(
  clickPath: CursorPathPoint[],
  rangeStartMs: number,
  rangeEndMs: number,
  speed = 1
): number[] {
  const result: number[] = [];
  for (const click of clickPath) {
    if (click.atMs < rangeStartMs || click.atMs >= rangeEndMs) continue;
    result.push((click.atMs - rangeStartMs) / 1000 / speed);
  }
  return result;
}

/**
 * Renders a full-length mono overlay buffer (silence except for `burst` at
 * each click time) spanning `totalFrames`. Built once per export segment so
 * per-chunk mixing can slice out of it rather than tracking a click's tail
 * across multiple decoder chunk boundaries -- the bundled click sound is
 * typically longer than one decoded `AudioData` chunk (e.g. ~21ms for a
 * 1024-sample AAC frame at 48kHz), so a single click's burst usually spans
 * several consecutive chunks.
 */
export function renderClickOverlay(
  clickTimesSec: number[],
  totalFrames: number,
  sampleRate: number,
  burst: Float32Array
): Float32Array {
  const overlay = new Float32Array(totalFrames);
  for (const t of clickTimesSec) {
    mixBurstInto(overlay, burst, Math.round(t * sampleRate));
  }
  return overlay;
}
