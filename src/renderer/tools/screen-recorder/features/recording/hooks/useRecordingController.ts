import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../../../app/app-store';
import { useRecordingStore } from '../store/recording-store';
import { startCapture, fileExtensionForBlob, type CaptureHandle } from '../engine/capture-engine';
import { startCursorCapture, type CursorCaptureHandle } from '../../cursor/engine/cursor-capture';
import { generateAutoZoomKeyframes } from '../../zoom/engine/auto-zoom-engine';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';

export interface LiveCounts {
  cursorCount: number;
  clickCount: number;
}

export interface StartResult {
  ok: boolean;
  error?: string;
}

export interface RecordingController {
  start: () => Promise<StartResult>;
  stop: () => Promise<void>;
  error: string | null;
  liveCounts: LiveCounts | null;
}

/**
 * Owns the actual capture session (MediaRecorder + cursor tracking refs).
 * Instantiated once (see RecordingControllerProvider) so every place that
 * can trigger "Start Recording" -- the persistent sidebar, and the
 * focus-view toolbar -- drives the same capture instead of racing to open
 * two independent getUserMedia streams.
 */
export function useRecordingController(): RecordingController {
  const setIsRecording = useAppStore((state) => state.setIsRecording);
  const setRoute = useAppStore((state) => state.setRoute);
  const setLastRecording = useAppStore((state) => state.setLastRecording);
  const [error, setError] = useState<string | null>(null);
  const [liveCounts, setLiveCounts] = useState<LiveCounts | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const cursorCaptureRef = useRef<CursorCaptureHandle | null>(null);

  const start = useCallback(async (): Promise<StartResult> => {
    // Read fresh rather than via a reactive subscription -- the focus
    // toolbar applies its chosen source/audio to the store and calls
    // `start()` in the same synchronous handler, before React has a chance
    // to re-render this hook with the new values.
    const { selectedSource, audio, cropRegion, autoZoomEnabled } = useRecordingStore.getState();
    if (!selectedSource) {
      const message = 'Pick a screen or window first.';
      setError(message);
      return { ok: false, error: message };
    }
    // Ownership of a native-picker stream (see recording-store.ts) moves
    // from the store to this call right now -- from this point on, an
    // unrelated setSelectedSource click elsewhere can't reach in and stop
    // the stream out from under an active capture.
    const nativePickerStream = useRecordingStore.getState().takeNativePickerStream();
    setError(null);
    setLiveCounts({ cursorCount: 0, clickCount: 0 });
    try {
      // `selectedSource.displayBounds` for a window source (currently just
      // the Simulator) was resolved via AppleScript whenever the source list
      // was last loaded -- possibly well before this click, during which the
      // window could have moved or resized. Re-resolve it right now, as
      // close to the actual capture/tracking start as possible, so both the
      // video's capture-size constraint and the cursor normalization rect
      // agree with where the window actually is. Not applicable to a
      // native-picker source -- it has no id for the Simulator check to
      // even match against.
      const source =
        !nativePickerStream && selectedSource.type === 'window'
          ? {
              ...selectedSource,
              displayBounds:
                (await window.screenRecorder.simulator.refreshWindowBounds().catch(() => null)) ??
                selectedSource.displayBounds
            }
          : selectedSource;

      captureRef.current = await startCapture({
        source,
        audio,
        existingVideoStream: nativePickerStream ?? undefined,
        cropRegion: cropRegion ?? undefined,
        webcam: useWebcamStore.getState()
      });
      // Cursor samples are normalized against `displayBounds` (see
      // cursor-capture.ts) -- when a crop region is active, the *recorded*
      // frame is that region, not the full display, so tracking has to be
      // re-based onto the region's own screen-space rect or overlaid cursor
      // positions would land in the wrong place on the (smaller) video.
      const cursorTrackingSource = cropRegion
        ? {
            ...source,
            displayBounds: {
              x: cropRegion.rect.x,
              y: cropRegion.rect.y,
              width: cropRegion.rect.width,
              height: cropRegion.rect.height
            }
          }
        : source;
      // Uses the recorder's *actual* startedAt (not a pre-call guess) so
      // cursor samples line up exactly with the video's own t=0. Skipped
      // entirely (not just discarded afterward) when the "Auto Zoom"
      // sidebar checkbox is off -- see `autoZoomEnabled` in
      // recording-store.ts -- so there's no tracking overhead and the
      // recording ends up with an empty cursor/click path, same as a
      // source with no resolvable bounds.
      cursorCaptureRef.current = autoZoomEnabled
        ? await startCursorCapture(
            cursorTrackingSource,
            captureRef.current.startedAt,
            setLiveCounts
          )
        : null;
      if (!cursorCaptureRef.current) setLiveCounts(null);
      setIsRecording(true);
      return { ok: true };
    } catch (err) {
      // Own the stream's cleanup here -- it was already taken out of the
      // store above, so nothing else will stop it if startCapture itself
      // never got far enough to.
      nativePickerStream?.getTracks().forEach((track) => track.stop());
      // Most likely cause: the user denied the (rare, OS-level) permission
      // prompt, or no capture source is actually available.
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return { ok: false, error: message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    const capture = captureRef.current;
    if (!capture) return;
    setIsRecording(false);

    const { blob, webcamBlob, webcamStartedAt } = await capture.stop();
    captureRef.current = null;

    const { cursorPath, clickPath } = (await cursorCaptureRef.current?.stop()) ?? {
      cursorPath: [],
      clickPath: []
    };
    cursorCaptureRef.current = null;

    // Fresh recording -> whatever zoom keyframes existed belonged to the
    // previous one and no longer mean anything on this timeline. Re-seed
    // from this recording's real clicks when in auto mode, otherwise just
    // clear them for the user to place manually.
    const zoomStore = useZoomStore.getState();
    zoomStore.setKeyframes(zoomStore.mode === 'auto' ? generateAutoZoomKeyframes(clickPath) : []);

    const previewUrl = URL.createObjectURL(blob);
    const extension = fileExtensionForBlob(blob);
    const timestamp = Date.now();
    const fileName = `recording-${timestamp}.${extension}`;

    let filePath: string | null = null;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      filePath = await window.screenRecorder.recording.saveFile(fileName, arrayBuffer);
    } catch (err) {
      console.error('[useRecordingController] failed to save recording to disk:', err);
    }

    let webcamPreviewUrl: string | null = null;
    let webcamFilePath: string | null = null;
    if (webcamBlob) {
      webcamPreviewUrl = URL.createObjectURL(webcamBlob);
      const webcamFileName = `recording-${timestamp}-webcam.${fileExtensionForBlob(webcamBlob)}`;
      try {
        const webcamArrayBuffer = await webcamBlob.arrayBuffer();
        webcamFilePath = await window.screenRecorder.recording.saveFile(
          webcamFileName,
          webcamArrayBuffer
        );
      } catch (err) {
        console.error('[useRecordingController] failed to save webcam recording to disk:', err);
      }
    }

    setLastRecording({
      previewUrl,
      filePath,
      sizeBytes: blob.size,
      createdAt: Date.now(),
      cursorPath,
      clickPath,
      webcamPreviewUrl,
      webcamFilePath,
      webcamOffsetMs: webcamStartedAt !== null ? webcamStartedAt - capture.startedAt : 0
    });
    setRoute('editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, error, liveCounts };
}
