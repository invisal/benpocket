import type { CaptureSource } from '@screen-recorder/types/recording';
import { useRecordingStore } from '../store/recording-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useAppStore } from '../../../app/app-store';

/**
 * Hides this window and opens the floating recorder-toolbar -- see
 * main/screen-recorder/windows/recorder-toolbar-window.ts. Reveals the
 * actual picked window/screen instead of a copy rendered inside the app.
 * Shared by SourcePicker's double-click (which already knows exactly which
 * source it wants) and the sidebar's "New Record" nav item/tray's "open
 * record picker" (which don't -- see those call sites).
 *
 * `source` is optional and deliberately not fetched here when omitted:
 * listing capture sources is the slow part of this whole flow (thumbnails
 * for every screen/window), and blocking the toolbar's own window creation
 * on it made "New Record" feel sluggish. Leaving it out opens the toolbar
 * immediately; RecorderToolbarApp's own (already-necessary) source fetch
 * picks a default once it resolves, same selection logic as here.
 */
export async function openRecorderToolbarFor(source?: CaptureSource): Promise<void> {
  if (source) useRecordingStore.getState().setSelectedSource(source);
  const { audio, countdownSeconds } = useRecordingStore.getState();
  const { enabled, deviceId, shape, mirrored, position, size, shadow } = useWebcamStore.getState();
  const { visible, clickRippleEnabled } = useCursorStore.getState();
  // Set before the IPC round-trip (not after) so "Launch Recorder" disables
  // immediately on click -- see ScreenRecorderSidebar.tsx -- rather than
  // staying clickable for the moment it takes the main process to minimize
  // this window and load the toolbar.
  useAppStore.getState().setRecorderToolbarOpen(true);
  try {
    await window.screenRecorder.recorderToolbar.open({
      sourceId: source?.id,
      audio,
      webcam: { enabled, deviceId, shape, mirrored, position, size, shadow },
      cursorSettings: { visible, clickRippleEnabled },
      countdownSeconds
    });
  } catch (err) {
    // The toolbar never actually opened, so it'll never send back the
    // RecorderToolbarClosed that normally clears this -- clear it directly,
    // or "Launch Recorder" would stay disabled forever.
    useAppStore.getState().setRecorderToolbarOpen(false);
    throw err;
  }
}
