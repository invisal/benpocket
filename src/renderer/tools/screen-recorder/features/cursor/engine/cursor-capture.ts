import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CursorPathPoint } from '@screen-recorder/types/project';
import type { WindowResizeSample, CursorCrosshairSample } from '@shared/cursor-path';

export interface CursorCaptureResult {
  cursorPath: CursorPathPoint[];
  /** Real mousedown events (via uiohook-napi), same normalization as cursorPath. */
  clickPath: CursorPathPoint[];
  /** Real observed window-bounds changes (window-bounds-poller.ts) and/or real OS resize-cursor sightings (cursor-shape-tracker.ts), merged and sorted by `atMs` -- lets `resolveCursorGesture` (@shared/cursor-path) know for a fact when a resize is actually happening, from whichever signal caught it. */
  resizePath: WindowResizeSample[];
  /** Real observed OS crosshair-cursor sightings (cursor-shape-tracker.ts) -- lets `resolveCursorGesture` know when a spreadsheet fill-handle/range-select drag is actually happening. */
  crosshairPath: CursorCrosshairSample[];
}

export interface CursorCaptureHandle {
  /** Stops main-process tracking and returns every sample collected, in order. */
  stop: () => Promise<CursorCaptureResult>;
}

/**
 * Starts recording the system cursor's position and real mouse clicks
 * alongside a screen capture. Returns `null` (nothing to start) if the
 * source has no resolved bounds to normalize against -- see
 * `CaptureSource.displayBounds`. Always true for 'screen' sources; for a
 * 'window' source, `useRecordingController.ts` re-resolves fresh bounds via
 * the window's native handle right before recording starts, so this
 * normally has something to work with for any window, not just a special
 * case -- unless that lookup itself fails (window closed, unsupported
 * platform), in which case tracking is skipped for this recording.
 *
 * `onUpdate` (optional) fires after every sample/click with the running
 * counts, so callers can show a live "N points captured" readout instead of
 * only finding out after `stop()` whether tracking actually worked.
 *
 * `followWindowId` (optional): a window's native handle to keep re-resolving
 * live bounds for over the course of the recording -- see
 * useRecordingController.ts, which only passes this for a plain 'window'
 * source (no crop region overriding `source.displayBounds` with a fixed
 * rect). Without it, dragging the recorded window mid-recording leaves
 * tracking normalized against wherever it was when recording started.
 */
export async function startCursorCapture(
  source: CaptureSource,
  startedAt: number,
  onUpdate?: (counts: { cursorCount: number; clickCount: number }) => void,
  followWindowId?: number | null
): Promise<CursorCaptureHandle | null> {
  if (!source.displayBounds) {
    console.warn(
      `[cursor-capture] skipping cursor tracking for "${source.name}" (type: ${source.type}) -- no resolved display bounds to normalize against.`
    );
    return null;
  }

  const cursorPath: CursorPathPoint[] = [];
  const clickPath: CursorPathPoint[] = [];
  const resizePath: WindowResizeSample[] = [];
  const crosshairPath: CursorCrosshairSample[] = [];
  const unsubscribeSample = window.screenRecorder.cursor.onSample((sample) => {
    cursorPath.push(sample);
    onUpdate?.({ cursorCount: cursorPath.length, clickCount: clickPath.length });
  });
  const unsubscribeClick = window.screenRecorder.cursor.onClickSample((sample) => {
    clickPath.push(sample);
    onUpdate?.({ cursorCount: cursorPath.length, clickCount: clickPath.length });
  });
  // Not folded into `onUpdate`'s counts -- not a user-facing "N points
  // captured" figure, just an internal signal for gesture resolution, so
  // there's nothing useful to surface live for this one.
  const unsubscribeResize = window.screenRecorder.cursor.onWindowResizeSample((sample) => {
    resizePath.push(sample);
  });
  // A second, independent producer feeding `resizePath` -- see
  // `WindowResizeSample`'s own doc (@shared/cursor-path) for why an internal
  // panel/split-view resize needs this real-cursor-shape signal instead of
  // (or alongside) a window-bounds diff. Also the sole producer for
  // `crosshairPath` (spreadsheet fill-handle/range-select).
  const unsubscribeShape = window.screenRecorder.cursor.onCursorShapeSample((sample) => {
    if (sample.kind === 'horizontal' || sample.kind === 'vertical') {
      resizePath.push({ atMs: sample.atMs, rotationDeg: sample.kind === 'horizontal' ? 0 : 90 });
    } else if (sample.kind === 'crosshair') {
      crosshairPath.push({ atMs: sample.atMs });
    }
  });

  await window.screenRecorder.cursor.startTracking(
    source.displayBounds,
    startedAt,
    followWindowId ?? null
  );

  return {
    stop: async () => {
      await window.screenRecorder.cursor.stopTracking();
      unsubscribeSample();
      unsubscribeClick();
      unsubscribeResize();
      unsubscribeShape();
      // Two independent producers feed `resizePath` (see its own doc) --
      // each arrives in order on its own IPC channel, but interleaved across
      // both there's no guarantee the merged array stays sorted by `atMs`,
      // which every consumer's binary search (mostRecentPointAtOrBefore,
      // @shared/cursor-path) requires.
      resizePath.sort((a, b) => a.atMs - b.atMs);
      console.log(
        `[cursor-capture] recorded ${cursorPath.length} cursor sample(s), ${clickPath.length} click(s), ${resizePath.length} resize sample(s), ${crosshairPath.length} crosshair sample(s).`
      );
      return { cursorPath, clickPath, resizePath, crosshairPath };
    }
  };
}
