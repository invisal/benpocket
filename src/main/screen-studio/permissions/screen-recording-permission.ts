import { shell, systemPreferences } from 'electron';
import type { ScreenRecordingStatus } from '@screen-studio/types/permissions';

// Screen Recording permission is a macOS-only gate (System Settings ->
// Privacy & Security -> Screen Recording). Without it, desktopCapturer still
// enumerates sources and getUserMedia still resolves successfully -- but
// every captured frame is solid black, with no error thrown anywhere. That
// makes it look like a recording/playback bug when it's actually a missing
// OS permission. Windows/Linux have no equivalent gate.
export function getScreenRecordingStatus(): ScreenRecordingStatus {
  if (process.platform !== 'darwin') return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('screen') as ScreenRecordingStatus;
  } catch {
    return 'unknown';
  }
}

export function openScreenRecordingSettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
}
