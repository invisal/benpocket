import type { CaptureSource } from '@screen-recorder/types/recording';
import { useRecordingStore } from '../store/recording-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';

/**
 * Hides this window and opens the floating recorder-toolbar for `source` --
 * see main/screen-recorder/windows/recorder-toolbar-window.ts. Reveals the
 * actual picked window/screen instead of a copy rendered inside the app.
 * Shared by SourcePicker's double-click and the sidebar's "New Record" nav
 * item, which skips the source grid entirely and opens straight to a
 * default source.
 */
export async function openRecorderToolbarFor(source: CaptureSource): Promise<void> {
  useRecordingStore.getState().setSelectedSource(source);
  const { audio } = useRecordingStore.getState();
  const { enabled, deviceId, shape, mirrored, position, size } = useWebcamStore.getState();
  await window.screenRecorder.recorderToolbar.open({
    sourceId: source.id,
    audio,
    webcam: { enabled, deviceId, shape, mirrored, position, size }
  });
}
