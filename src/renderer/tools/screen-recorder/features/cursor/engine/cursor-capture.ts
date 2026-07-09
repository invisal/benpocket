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
 * alongside a screen capture. Returns `null` (nothing to start) for 'window'
 * sources, since a window has no fixed screen bounds to normalize against --
 * see `CaptureSource.displayBounds`.
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
  if (source.type !== 'screen' || !source.displayBounds) {
    console.warn(
      `[cursor-capture] skipping cursor tracking for "${source.name}" (type: ${source.type}, displayBounds: ${Boolean(source.displayBounds)}) -- only 'screen' sources with resolved display bounds are tracked.`
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
