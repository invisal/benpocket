export const CAPTURE_DELAY_OPTIONS = [3, 5, 10] as const;
export type CaptureDelaySeconds = (typeof CAPTURE_DELAY_OPTIONS)[number];
export type CaptureDelaySetting = 0 | CaptureDelaySeconds;

export function normalizeCaptureDelay(value: unknown): CaptureDelaySetting {
  if (value === 3 || value === 5 || value === 10) return value;
  return 0;
}

export function captureDelayLabel(seconds: CaptureDelaySetting): string {
  return seconds === 0 ? 'Off' : `${seconds}s`;
}

/**
 * Visible countdown before a grab. `onTick` fires once per remaining second
 * (e.g. 3, 2, 1). Resolves false if `signal` aborts.
 */
export async function runCaptureCountdown(
  seconds: number,
  onTick: (remaining: number) => void,
  options?: { signal?: AbortSignal; intervalMs?: number }
): Promise<boolean> {
  if (seconds <= 0) return true;
  const signal = options?.signal;
  if (signal?.aborted) return false;

  const intervalMs = options?.intervalMs ?? 1000;
  for (let remaining = seconds; remaining > 0; remaining--) {
    if (signal?.aborted) return false;
    onTick(remaining);
    const waited = await sleep(intervalMs, signal);
    if (!waited) return false;
  }
  return true;
}

function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
