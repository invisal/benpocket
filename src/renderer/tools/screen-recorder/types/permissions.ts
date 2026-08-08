// Mirrors main/permissions/screen-recording-permission.ts's return values
// (which mostly just forward Electron's systemPreferences.getMediaAccessStatus
// on macOS; every other platform reports 'granted' since there's no
// equivalent OS-level gate there).
export type ScreenRecordingStatus =
  'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';

/** Same shape, for the microphone gate -- see getMicrophoneStatus. */
export type MicrophoneStatus = ScreenRecordingStatus;
