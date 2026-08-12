import { useEffect, type JSX } from 'react';
import type { RecorderToolbarStartPayload } from '@shared/recorder-toolbar';
import { useRecordingStore } from '../store/recording-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useRecordingControllerContext } from '../context/recording-controller-context';
import { useAppStore } from '../../../app/app-store';
import { openRecorderToolbarFor } from '../lib/open-recorder-toolbar';

/**
 * Renders nothing -- just relays the floating recorder-toolbar window's
 * requests into this (hidden, while the toolbar is open) window's actual
 * recording controller. The toolbar is a separate renderer process with its
 * own local audio/webcam state, so its "Start Recording" click only ever
 * arrives here as plain IPC data (see main/screen-recorder/windows/
 * recorder-toolbar-window.ts), never a shared store reference.
 */
export function RecorderToolbarBridge(): JSX.Element | null {
  const { start, stop, stopAndDiscard, restart } = useRecordingControllerContext();

  useEffect(() => {
    return window.screenRecorder.recorderToolbar.onStartRequested(
      async (payload: RecorderToolbarStartPayload) => {
        try {
          const sources = await window.screenRecorder.recording.getCaptureSources();
          const source = sources.find((s) => s.id === payload.sourceId);
          if (!source) {
            window.screenRecorder.recorderToolbar.reportRecordingStarted({
              ok: false,
              error: 'That source is no longer available.'
            });
            return;
          }

          // setSelectedSource clears any previous cropRegion as a side
          // effect (a new pick invalidates the old rect) -- setCropRegion
          // has to run after it to actually apply this payload's region.
          useRecordingStore.getState().setSelectedSource(source);
          useRecordingStore.getState().setAudio(payload.audio);
          useRecordingStore.getState().setCropRegion(payload.cropRegion ?? null);
          useRecordingStore.getState().setCountdownSeconds(payload.countdownSeconds);
          useWebcamStore.setState(payload.webcam);
          useCursorStore.getState().setVisible(payload.cursorSettings.visible);
          useCursorStore
            .getState()
            .setClickRippleEnabled(payload.cursorSettings.clickRippleEnabled);

          const result = await start();
          window.screenRecorder.recorderToolbar.reportRecordingStarted(result);
        } catch (err) {
          window.screenRecorder.recorderToolbar.reportRecordingStarted({
            ok: false,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    );
  }, [start]);

  useEffect(() => {
    return window.screenRecorder.recorderToolbar.onStopRequested(() => {
      void stop().then(() => window.screenRecorder.recorderToolbar.reportRecordingStopped());
    });
  }, [stop]);

  // Discards the in-progress recording and immediately starts a fresh one
  // with the same settings -- there's no native "abort without finalizing"
  // command (see recording-helper.ts), so this is a real stop-then-start
  // round trip under the hood, not an instant in-place reset.
  useEffect(() => {
    return window.screenRecorder.recorderToolbar.onRestartRequested(async () => {
      const result = await restart();
      window.screenRecorder.recorderToolbar.reportRecordingStarted(result);
    });
  }, [restart]);

  // Discards the in-progress recording entirely -- same "finalize then
  // delete the file" mechanism as Restart, but doesn't start a new one.
  // Unlike Finish, there's nothing to hand off to the editor -- the user
  // explicitly threw the recording away, so once the old toolbar/recording
  // state has torn down (reportRecordingStopped), reopen a fresh toolbar
  // instead of leaving them looking at whatever (likely stale) route was
  // underneath, e.g. a different project's editor.
  useEffect(() => {
    return window.screenRecorder.recorderToolbar.onDeleteRequested(() => {
      void stopAndDiscard()
        .then(() => window.screenRecorder.recorderToolbar.reportRecordingStopped())
        .then(() => openRecorderToolbarFor());
    });
  }, [stopAndDiscard]);

  useEffect(
    () =>
      window.screenRecorder.recorderToolbar.onClosed(() => {
        useAppStore.getState().setRecorderToolbarOpen(false);
      }),
    []
  );

  return null;
}
