import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CursorPathPoint } from '@screen-recorder/types/project';

export interface CursorCaptureResult {
  cursorPath: CursorPathPoint[];
  /** Real mousedown events (via uiohook-napi), same normalization as cursorPath. */
  clickPath: CursorPathPoint[];
}

export interface CursorCaptureHandle {
  /** Stops main-process tracking and returns every sample collected, in order. */
  stop: () => Promise<CursorCaptureResult>;
}

/**
 * Starts recording the system cursor's position and real mouse clicks
 * alongside a screen capture. Returns `null` (nothing to start) if the
 * source has no resolved bounds to normalize against -- see
 * `CaptureSource.displayBounds`. That's normally only 'screen' sources, but
 * a 'window' source can have bounds too (currently just the Simulator
 * window, see screen-source-provider.ts), in which case it's tracked the
 * same way.
 *
 * `onUpdate` (optional) fires after every sample/click with the running
 * counts, so callers can show a live "N points captured" readout instead of
 * only finding out after `stop()` whether tracking actually worked.
 */
export async function startCursorCapture(
  source: CaptureSource,
  startedAt: number,
  onUpdate?: (counts: { cursorCount: number; clickCount: number }) => void
): Promise<CursorCaptureHandle | null> {
  if (!source.displayBounds) {
    console.warn(
      `[cursor-capture] skipping cursor tracking for "${source.name}" (type: ${source.type}) -- no resolved display bounds to normalize against.`
    );
    return null;
  }

  const cursorPath: CursorPathPoint[] = [];
  const clickPath: CursorPathPoint[] = [];
  const unsubscribeSample = window.screenRecorder.cursor.onSample((sample) => {
    cursorPath.push(sample);
    onUpdate?.({ cursorCount: cursorPath.length, clickCount: clickPath.length });
  });
  const unsubscribeClick = window.screenRecorder.cursor.onClickSample((sample) => {
    clickPath.push(sample);
    onUpdate?.({ cursorCount: cursorPath.length, clickCount: clickPath.length });
  });

  await window.screenRecorder.cursor.startTracking(source.displayBounds, startedAt);

  return {
    stop: async () => {
      await window.screenRecorder.cursor.stopTracking();
      unsubscribeSample();
      unsubscribeClick();
      console.log(
        `[cursor-capture] recorded ${cursorPath.length} cursor sample(s), ${clickPath.length} click(s).`
      );
      return { cursorPath, clickPath };
    }
  };
}
