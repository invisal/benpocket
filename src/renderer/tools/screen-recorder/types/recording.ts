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
   * for `'screen'` sources; for `'window'` sources, `desktopCapturer` itself
   * exposes none at list time -- the one exception is the Simulator app's
   * window, resolved via AppleScript/System Events (see window-bounds.ts,
   * screen-source-provider.ts) so its thumbnail in the source picker can
   * show a live on-screen highlight outline. Every window source (Simulator
   * included) gets a *fresh* bounds lookup right before recording actually
   * starts regardless -- see useRecordingController.ts's `start()`, which
   * resolves it via the window's native handle (getWindowBoundsById, main
   * process) rather than trusting whatever this field held at list time --
   * so cursor/click tracking works for any window, not just the Simulator.
   * That refresh is still just a one-time snapshot, so moving/resizing the
   * window mid-recording makes tracking drift for the rest of that
   * recording either way.
   */
  displayBounds?: { x: number; y: number; width: number; height: number };
  /**
   * Only set for `'screen'` sources, true for the one matching
   * `screen.getPrimaryDisplay()`. `desktopCapturer.getSources()` doesn't
   * enumerate screens in any guaranteed order -- on macOS in particular, a
   * newly-connected external monitor can sort before the built-in display --
   * so anything defaulting to "the first screen source" (quick-record entry
   * points, initial SourcePicker selection) needs this to actually mean "the
   * primary one" instead of whichever the OS happened to list first.
   */
  isPrimaryDisplay?: boolean;
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
