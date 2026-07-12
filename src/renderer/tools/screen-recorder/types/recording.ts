export type CaptureTargetType = 'screen' | 'window';

export interface CaptureSource {
  id: string;
  name: string;
  type: CaptureTargetType;
  thumbnailDataUrl: string;
  displayId?: string;
  /**
   * Screen/window bounds in OS screen-coordinate space. Lets the main
   * process normalize `screen.getCursorScreenPoint()` samples to 0-1
   * fractions of the captured area during cursor tracking. Always present
   * for `'screen'` sources; for `'window'` sources it's normally absent (a
   * window can move/resize during capture, and desktopCapturer doesn't
   * expose window bounds at all) -- the one exception is the Simulator
   * app's window, which gets it via AppleScript/System Events (see
   * window-bounds.ts, screen-source-provider.ts) specifically so iOS
   * Simulator recordings still get cursor/click tracking. Snapshotted once
   * at recording start either way, so moving/resizing the window mid-
   * recording still makes tracking drift for the rest of that recording.
   */
  displayBounds?: { x: number; y: number; width: number; height: number };
}

export interface AudioInputOptions {
  microphoneEnabled: boolean;
  microphoneDeviceId?: string;
  systemAudioEnabled: boolean;
}

export interface WebcamOptions {
  enabled: boolean;
  deviceId?: string;
  shape: 'circle' | 'rounded-square' | 'square';
  mirrored: boolean;
  position: { x: number; y: number };
  size: number;
}

export interface RecordingRequest {
  source: CaptureSource;
  audio: AudioInputOptions;
  webcam: WebcamOptions;
}

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'paused' | 'processing';

export interface RecordingSession {
  id: string;
  state: RecordingState;
  startedAt?: number;
  request: RecordingRequest;
}
