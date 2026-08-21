export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Short "Ns" / "N.Ns" duration label for clip pills and cut-marker badges --
 * distinct from `formatTime`'s "m:ss" (the ruler/transport readout), matching
 * how a few-second clip is normally talked about ("22s", "0.9s") rather than
 * as minutes.
 */
export function formatShortDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 1) return `${totalSeconds.toFixed(1)}s`;
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  return formatTime(ms);
}

// "Nice" tick spacings to choose from so the ruler never gets cluttered
// regardless of recording length or zoom.
const NICE_TICK_INTERVALS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
const TARGET_MAJOR_TICK_COUNT = 8;

export function pickMajorTickIntervalMs(totalDurationMs: number): number {
  const totalSec = totalDurationMs / 1000;
  const interval =
    NICE_TICK_INTERVALS_SEC.find((sec) => totalSec / sec <= TARGET_MAJOR_TICK_COUNT) ??
    NICE_TICK_INTERVALS_SEC[NICE_TICK_INTERVALS_SEC.length - 1];
  return interval * 1000;
}
