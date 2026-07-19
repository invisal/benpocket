import { useEffect, type JSX } from 'react';
import type { RecorderToolbarStartPayload } from '@shared/recorder-toolbar';
import { useRecordingStore } from '../store/recording-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useRecordingControllerContext } from '../context/recording-controller-context';
import { useAppStore } from '../../../app/app-store';

/**
 * Renders nothing -- just relays the floating recorder-toolbar window's
 * requests into this (hidden, while the toolbar is open) window's actual
 * recording controller. The toolbar is a separate renderer process with its
 * own local audio/webcam state, so its "Start Recording" click only ever
 * arrives here as plain IPC data (see main/screen-recorder/windows/
 * recorder-toolbar-window.ts), never a shared store reference.
 */
export function RecorderToolbarBridge(): JSX.Element | null {
  const { start, stop } = useRecordingControllerContext();

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
          useWebcamStore.setState(payload.webcam);

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

  useEffect(
    () =>
      window.screenRecorder.recorderToolbar.onClosed(() => {
        useAppStore.getState().setRecorderToolbarOpen(false);
      }),
    []
  );

  return null;
}
