// Mirrors main/permissions/permissions.ts's return values (which mostly just
// forward Electron's systemPreferences.getMediaAccessStatus on macOS; every
// other platform reports 'granted' since there's no equivalent OS-level gate
// there).
export type ScreenRecordingStatus =
  'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';

/** Same shape, for the microphone gate -- see getMicrophoneStatus. */
export type MicrophoneStatus = ScreenRecordingStatus;

/** Same shape, for the camera gate -- see getCameraStatus. */
export type CameraStatus = ScreenRecordingStatus;

/** Electron exposes no 'restricted'/'denied' distinction for Accessibility -- isTrustedAccessibilityClient is just a boolean, mapped to 'granted' | 'not-determined'. */
export type AccessibilityStatus = 'granted' | 'not-determined';

/** No Electron API exists for this gate at all -- status is inferred from an osascript exit code, see requestAutomationAccess. 'unknown' covers osascript itself failing to spawn. */
export type AutomationStatus = 'granted' | 'not-determined' | 'unknown';
