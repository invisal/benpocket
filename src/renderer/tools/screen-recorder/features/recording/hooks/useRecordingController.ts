import { useCallback, useEffect, useRef, useState } from 'react';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useRecordingStore } from '../store/recording-store';
import { startCapture, fileExtensionForBlob, type CaptureHandle } from '../engine/capture-engine';
import { startCursorCapture, type CursorCaptureHandle } from '../../cursor/engine/cursor-capture';
import { generateAutoZoomKeyframes } from '../../zoom/engine/auto-zoom-engine';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { parseWindowSourceId } from '@shared/window-source-id';
import { toRecordingMediaUrl } from '@shared/media-protocol';
import { resetContentStoresForNewRecording } from '../../project/lib/reset-content-stores-for-new-recording';
import { isLikelyLinux } from '../../../lib/platform';

export interface LiveCounts {
  cursorCount: number;
  clickCount: number;
}

export interface StartResult {
  ok: boolean;
  error?: string;
  /** Whether this recording is on the native helper path -- only it supports Pause/Resume (see CaptureHandle.native). */
  native?: boolean;
}

export interface RecordingController {
  start: () => Promise<StartResult>;
  stop: () => Promise<void>;
  /** Stops and discards the in-progress recording -- no editor hand-off, and the finalized file is deleted rather than kept. */
  stopAndDiscard: () => Promise<void>;
  /** Discards the in-progress recording and immediately starts a fresh one with the same settings. */
  restart: () => Promise<StartResult>;
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
  const setIsRecording = useScreenRecorderStore((state) => state.setIsRecording);
  const setRoute = useScreenRecorderStore((state) => state.setRoute);
  const setLastRecording = useScreenRecorderStore((state) => state.setLastRecording);
  const [error, setError] = useState<string | null>(null);
  const [liveCounts, setLiveCounts] = useState<LiveCounts | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const cursorCaptureRef = useRef<CursorCaptureHandle | null>(null);
  const recordingOptionsRef = useRef<{
    sourceType: 'screen' | 'window';
    micEnabled: boolean;
    systemAudioEnabled: boolean;
    webcamEnabled: boolean;
  } | null>(null);

  // Safety net for this component unmounting mid-recording -- e.g. the
  // Screen Recorder tab getting swapped out for another tab while the
  // floating toolbar is still up and recording (Workspace.tsx only keeps
  // Kuberneter tabs mounted when inactive, not this one). captureRef/
  // cursorCaptureRef are plain refs, so an ordinary unmount would otherwise
  // just drop the last reference to a live capture without ever calling its
  // stop() -- orphaning the native helper process (or leaked
  // MediaStreamTracks) and leaving the OS "screen is being recorded"
  // indicator on indefinitely, since nothing is left to call stop() later.
  // Fire-and-forget: an unmount can't be awaited, and by the time this runs
  // there's no toolbar/editor left to hand a result to anyway -- this only
  // exists to release the OS-level resources, not to save the recording.
  useEffect(() => {
    return () => {
      captureRef.current?.stop().catch(() => {});
      cursorCaptureRef.current?.stop().catch(() => {});
    };
  }, []);

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
      const isWindowSource = !nativePickerStream && selectedSource.type === 'window';
      // Restores/foregrounds the target window before anything below reads
      // its bounds or starts capturing it -- picking a source from the list
      // doesn't itself refocus anything, so without this a minimized (or
      // just-occluded-by-this-app's-own-picker) window would still be
      // minimized/behind when recording starts. A minimized window reports
      // its bounds at Windows' off-screen sentinel position, which would
      // otherwise make every cursor sample below resolve as "out of bounds"
      // (see cursor-tracker.ts) and can leave WGC capturing a blank frame.
      // Windows-only (see win-window-focus.ts); resolves to a no-op
      // elsewhere.
      if (isWindowSource) {
        await window.screenRecorder.recording
          .focusCaptureWindow(selectedSource.id)
          .catch(() => false);
      }
      // `selectedSource.displayBounds` for a window source was whatever was
      // resolved (or not -- see CaptureSource.displayBounds) whenever the
      // source list was last loaded, possibly well before this click, during
      // which the window could have moved or resized. Re-resolve it right
      // now, as close to the actual capture/tracking start as possible, so
      // both the video's capture-size constraint and the cursor
      // normalization rect agree with where the window actually is -- for
      // *any* window, not just a hardcoded special case (see
      // getWindowBoundsById's doc on the main process side). Not applicable
      // to a native-picker source -- it has no desktopCapturer id to resolve
      // a window handle from.
      const source = isWindowSource
        ? {
            ...selectedSource,
            displayBounds:
              (await window.screenRecorder.recording
                .refreshWindowBounds(selectedSource.id)
                .catch(() => null)) ?? selectedSource.displayBounds
          }
        : selectedSource;

      captureRef.current = await startCapture({
        source,
        audio,
        existingVideoStream: nativePickerStream ?? undefined,
        cropRegion: cropRegion ?? undefined,
        webcam: useWebcamStore.getState(),
        // Only hide the native OS cursor when the app's own stylized
        // overlay ("Show Cursor" in the Cursor panel) is actually enabled
        // to replace it -- otherwise the ordinary OS cursor stays baked
        // in, same as before native capture existed.
        hideNativeCursor: useCursorStore.getState().visible
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
      // Keeps tracking following the window if it's dragged/resized mid-
      // recording (see window-bounds-poller.ts) -- only meaningful for a
      // plain window source, since a crop region already pins tracking to
      // its own fixed screen-space rect above, and a native-picker source
      // has no desktopCapturer window handle to poll.
      const followWindowId =
        !cropRegion && source.type === 'window' ? parseWindowSourceId(source.id) : null;
      // Uses the recorder's *actual* startedAt (not a pre-call guess) so
      // cursor samples line up exactly with the video's own t=0. Skipped
      // entirely (not just discarded afterward) when the "Auto Zoom"
      // sidebar checkbox is off -- see `autoZoomEnabled` in
      // recording-store.ts -- so there's no tracking overhead and the
      // recording ends up with an empty cursor/click path, same as a
      // source with no resolvable bounds. Also always skipped on Linux --
      // neither `screen.getCursorScreenPoint()` nor uiohook-napi's global
      // click hook produce real data there (confirmed on Wayland; not worth
      // attempting even on X11, where behavior is inconsistent across
      // compositors), so tracking would just spend the whole recording
      // collecting samples nobody can use. The Cursor tool panel and
      // auto-zoom keyframe generation are hidden/disabled on Linux to match
      // -- see EditorToolRail.tsx/EditorToolPanel.tsx/EditorPage.tsx and
      // `generateAutoZoomKeyframes`'s call site below.
      cursorCaptureRef.current =
        autoZoomEnabled && !isLikelyLinux
          ? await startCursorCapture(
              cursorTrackingSource,
              captureRef.current.startedAt,
              setLiveCounts,
              followWindowId
            )
          : null;
      if (!cursorCaptureRef.current) setLiveCounts(null);
      // Snapshot the options this recording actually started with -- `stop()`
      // reports on them for telemetry, and `audio`/webcam state can drift
      // between start and stop (e.g. toggled mid-recording in the toolbar).
      recordingOptionsRef.current = {
        sourceType: source.type,
        micEnabled: audio.microphoneEnabled,
        systemAudioEnabled: audio.systemAudioEnabled,
        webcamEnabled: useWebcamStore.getState().enabled
      };
      setIsRecording(true);
      return { ok: true, native: captureRef.current.native };
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

  // Everything through "the finished file(s) are on disk" -- shared by
  // `stop()` (which then hands off to the editor) and `stopAndDiscard()`
  // (which throws the result away instead). Returns null if nothing was
  // recording to begin with.
  const finalize = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return null;
    setIsRecording(false);

    const { video, webcamBlob, webcamExportSourceBlob, webcamStartedAt } = await capture.stop();
    const { blob } = video;
    captureRef.current = null;

    const options = recordingOptionsRef.current;
    recordingOptionsRef.current = null;
    if (options) {
      window.telemetry.send({
        event: 'screen-recorder:record',
        durationSec: Math.round((Date.now() - capture.startedAt) / 1000),
        sourceType: options.sourceType,
        micEnabled: options.micEnabled,
        systemAudioEnabled: options.systemAudioEnabled,
        webcamEnabled: options.webcamEnabled
      });
    }

    const { cursorPath, clickPath, resizePath, crosshairPath, textSelectPath } =
      (await cursorCaptureRef.current?.stop()) ?? {
        cursorPath: [],
        clickPath: [],
        resizePath: [],
        crosshairPath: [],
        textSelectPath: []
      };
    cursorCaptureRef.current = null;

    // Fresh recording -> whatever zoom keyframes existed belonged to the
    // previous one and no longer mean anything on this timeline. Re-seed
    // from this recording's real clicks when in auto mode, otherwise just
    // clear them for the user to place manually.
    const zoomStore = useZoomStore.getState();
    zoomStore.setKeyframes(zoomStore.mode === 'auto' ? generateAutoZoomKeyframes(clickPath) : []);

    const extension = fileExtensionForBlob(blob);
    const timestamp = Date.now();
    const fileName = `recording-${timestamp}.${extension}`;

    // The native recording path already wrote the file directly to its
    // final destination (see capture-engine.ts's `tryStartNativeRecording`)
    // -- re-saving `blob`'s bytes here would just be a wasteful round trip
    // through memory for what can be a large video file.
    let filePath: string | null = video.existingFilePath ?? null;
    if (!filePath) {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        filePath = await window.screenRecorder.recording.saveFile(fileName, arrayBuffer);
      } catch (err) {
        console.error('[useRecordingController] failed to save recording to disk:', err);
      }
    }
    // Points the editor at the saved file in place rather than an in-memory
    // Blob URL -- see `toRecordingMediaUrl`'s doc. Only falls back to a Blob
    // URL if the save above actually failed, so there's still *something*
    // to preview for this session even though nothing was written to disk.
    const previewUrl = filePath ? toRecordingMediaUrl(filePath) : URL.createObjectURL(blob);

    // See StopResult.video.exportSourceBlob's doc -- saved as its own file
    // (not reused from `filePath`'s save above) so export can read an
    // untouched source while everything else keeps using the
    // duration-patched `filePath` exactly as before. Best-effort: falling
    // back to `filePath` on failure (or when this recording never produced
    // one, e.g. the native path) just re-exposes today's existing behavior.
    let exportSourceFilePath: string | null = null;
    if (video.exportSourceBlob) {
      try {
        const exportSourceArrayBuffer = await video.exportSourceBlob.arrayBuffer();
        exportSourceFilePath = await window.screenRecorder.recording.saveFile(
          `recording-${timestamp}-source.${fileExtensionForBlob(video.exportSourceBlob)}`,
          exportSourceArrayBuffer
        );
      } catch (err) {
        console.error('[useRecordingController] failed to save export-source recording:', err);
      }
    }

    let webcamPreviewUrl: string | null = null;
    let webcamFilePath: string | null = null;
    if (webcamBlob) {
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
      webcamPreviewUrl = webcamFilePath
        ? toRecordingMediaUrl(webcamFilePath)
        : URL.createObjectURL(webcamBlob);
    }

    // Same reasoning as `exportSourceFilePath` above, for the webcam file.
    let webcamExportSourceFilePath: string | null = null;
    if (webcamExportSourceBlob) {
      try {
        const webcamExportSourceArrayBuffer = await webcamExportSourceBlob.arrayBuffer();
        webcamExportSourceFilePath = await window.screenRecorder.recording.saveFile(
          `recording-${timestamp}-webcam-source.${fileExtensionForBlob(webcamExportSourceBlob)}`,
          webcamExportSourceArrayBuffer
        );
      } catch (err) {
        console.error('[useRecordingController] failed to save export-source webcam:', err);
      }
    }

    return {
      previewUrl,
      filePath,
      exportSourceFilePath: exportSourceFilePath ?? filePath,
      webcamFilePath,
      webcamExportSourceFilePath: webcamExportSourceFilePath ?? webcamFilePath,
      sizeBytes: blob.size,
      cursorPath,
      clickPath,
      resizePath,
      crosshairPath,
      textSelectPath,
      webcamPreviewUrl,
      webcamOffsetMs: webcamStartedAt !== null ? webcamStartedAt - capture.startedAt : 0
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    const result = await finalize();
    if (!result) return;
    const {
      filePath,
      exportSourceFilePath,
      webcamFilePath,
      webcamExportSourceFilePath,
      sizeBytes,
      cursorPath,
      clickPath,
      resizePath,
      crosshairPath,
      textSelectPath,
      previewUrl,
      webcamPreviewUrl,
      webcamOffsetMs
    } = result;

    setLastRecording({
      previewUrl,
      filePath,
      exportSourceFilePath,
      sizeBytes,
      createdAt: Date.now(),
      cursorPath,
      clickPath,
      resizePath,
      crosshairPath,
      textSelectPath,
      webcamPreviewUrl,
      webcamFilePath,
      webcamExportSourceFilePath,
      webcamOffsetMs,
      source: 'recorded'
    });
    // A fresh recording is a new, unsaved project -- clear whatever project
    // was open before "Return to Recorder" was clicked, same as
    // import-video.ts does for imports, so "Save" can't silently overwrite
    // it instead of creating a new one.
    useScreenRecorderStore.setState({ currentProjectId: null, projectName: 'Untitled Recording' });
    // Also clear whatever the previous project's background/cursor/captions/
    // annotations/blur-mask/crop stores held -- without this they'd silently
    // carry over into this new recording's editor session instead of
    // starting blank. After `finalize()` (already reset zoom's keyframes
    // above) so it doesn't disturb that decision.
    resetContentStoresForNewRecording();
    setRoute('editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalize]);

  // Restart/Delete both need "stop the capture, but don't hand off to the
  // editor" -- there's no native "abort without finalizing" (every native
  // `stop` writes a real file, see recording-helper.ts), so discarding means
  // actually finalizing then deleting what was just written.
  const stopAndDiscard = useCallback(async (): Promise<void> => {
    const result = await finalize();
    if (!result) return;
    const { filePath, exportSourceFilePath, webcamFilePath, webcamExportSourceFilePath } = result;
    if (filePath) await window.screenRecorder.recording.deleteFile(filePath).catch(() => {});
    // Only a distinct file when export-source saving actually ran (see
    // finalize()'s `?? filePath` default) -- skip re-deleting the same path.
    if (exportSourceFilePath && exportSourceFilePath !== filePath) {
      await window.screenRecorder.recording.deleteFile(exportSourceFilePath).catch(() => {});
    }
    if (webcamFilePath)
      await window.screenRecorder.recording.deleteFile(webcamFilePath).catch(() => {});
    if (webcamExportSourceFilePath && webcamExportSourceFilePath !== webcamFilePath) {
      await window.screenRecorder.recording.deleteFile(webcamExportSourceFilePath).catch(() => {});
    }
  }, [finalize]);

  const restart = useCallback(async (): Promise<StartResult> => {
    await stopAndDiscard();
    return start();
  }, [stopAndDiscard, start]);

  return { start, stop, stopAndDiscard, restart, error, liveCounts };
}
