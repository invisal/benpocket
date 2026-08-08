import { spawn } from 'child_process';
import { app, shell, systemPreferences } from 'electron';
import type {
  AccessibilityStatus,
  AutomationStatus,
  CameraStatus,
  MicrophoneStatus,
  ScreenRecordingStatus
} from '@screen-recorder/types/permissions';

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

// Unlike Screen Recording, Electron's getMediaAccessStatus is documented for
// 'microphone'/'camera' on win32 too (Windows 10+'s own global Privacy
// toggle) -- only Linux has no equivalent gate at all here.
function supportsMediaAccessStatus(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

export function getMicrophoneStatus(): MicrophoneStatus {
  if (!supportsMediaAccessStatus()) return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('microphone') as MicrophoneStatus;
  } catch {
    return 'unknown';
  }
}

export function openMicrophoneSettings(): void {
  if (process.platform === 'darwin') {
    void shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
    );
  } else if (process.platform === 'win32') {
    void shell.openExternal('ms-settings:privacy-microphone');
  }
}

// Unlike Screen Recording (no programmatic "request" API exists -- only an
// actual capture attempt can trigger it, which is what the native helper's
// CGRequestScreenCaptureAccess() does at record time), Electron exposes a
// real request call for the mic -- but per its own docs, only on macOS.
// Windows manages mic/camera access entirely through its own OS-wide toggle
// with no per-app runtime prompt to trigger, so there's nothing to request
// there beyond re-checking whatever that toggle already says. On macOS,
// calling it is what makes this app show up as a toggle-able entry in
// Privacy & Security -> Microphone at all -- it only lists an app there
// *after* it has asked at least once, which otherwise never happens until
// the user actually starts a mic-enabled recording. Resolves immediately (no
// prompt) if status is already determined either way, so it's safe to call
// every time "Open Settings" is clicked, not just the first.
export async function requestMicrophoneAccess(): Promise<MicrophoneStatus> {
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('microphone');
  return getMicrophoneStatus();
}

// Apple deliberately re-checks Screen Recording (and mic) authorization only
// at process launch, not live -- so a permission the user just flipped on in
// System Settings still reads as ungranted to this already-running process
// until it's relaunched. `app.relaunch()` queues a new instance; `app.exit()`
// (not `app.quit()`, which can be delayed/cancelled by window-close handlers)
// tears this one down immediately so the queued relaunch actually starts.
export function relaunchApp(): void {
  app.relaunch();
  app.exit(0);
}

/** Same gate as microphone (see supportsMediaAccessStatus) -- for the toolbar's camera-preview popover (see RecorderToolbarApp.tsx's getUserMedia({video}) call). */
export function getCameraStatus(): CameraStatus {
  if (!supportsMediaAccessStatus()) return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('camera') as CameraStatus;
  } catch {
    return 'unknown';
  }
}

export function openCameraSettings(): void {
  if (process.platform === 'darwin') {
    void shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
    );
  } else if (process.platform === 'win32') {
    void shell.openExternal('ms-settings:privacy-webcam');
  }
}

/** Same request-then-refresh shape as requestMicrophoneAccess -- see its doc. */
export async function requestCameraAccess(): Promise<CameraStatus> {
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('camera');
  return getCameraStatus();
}

// Global mouse/click tracking (click-tracker.ts's uiohook-napi hook, used to
// auto-generate zoom keyframes from real clicks) needs Accessibility, a
// third TCC gate distinct from Screen Recording and Microphone -- silently
// receiving zero events rather than erroring when it's missing, per that
// file's own doc comment. `isTrustedAccessibilityClient(false)` only checks;
// `true` also raises the native prompt and registers this app as a
// toggle-able row in Privacy & Security -> Accessibility, the same
// "must ask once to appear in the list" requirement Microphone has.
export function getAccessibilityStatus(): AccessibilityStatus {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';
}

export function requestAccessibilityAccess(): AccessibilityStatus {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.isTrustedAccessibilityClient(true) ? 'granted' : 'not-determined';
}

export function openAccessibilitySettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  );
}

// Automation (AppleEvents) is a fourth, per-target-app TCC gate -- needed to
// control "System Events" for a booted iOS Simulator's window bounds (see
// window-bounds.ts's doc). Unlike the media-type gates above, Electron
// exposes no status/request API for it at all; the only way to check or
// register it is to actually attempt an AppleScript call against "System
// Events" and read osascript's exit code, exactly like window-bounds.ts
// already does for the real bounds query -- this is a harmless no-op
// version of that same call, used purely to surface/trigger the one-time
// permission prompt from Settings rather than waiting for the first
// Simulator recording to hit it.
export function requestAutomationAccess(): Promise<AutomationStatus> {
  if (process.platform !== 'darwin') return Promise.resolve('granted');
  return new Promise((resolve) => {
    const proc = spawn('osascript', ['-e', 'tell application "System Events" to return true']);
    proc.on('error', () => resolve('unknown'));
    proc.on('close', (code) => resolve(code === 0 ? 'granted' : 'not-determined'));
  });
}

export function openAutomationSettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
  );
}
