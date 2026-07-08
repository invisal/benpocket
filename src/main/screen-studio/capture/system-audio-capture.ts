// System (loopback) audio capture is platform-specific:
//  - macOS: requires a virtual audio driver or a ScreenCaptureKit audio tap
//  - Windows: WASAPI loopback capture
//  - Linux: PulseAudio/PipeWire monitor source
// TODO: implement per-platform loopback capture, likely via a native addon
// or an external helper binary, and expose a single cross-platform API here.
export interface SystemAudioCapture {
  isSupported(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createSystemAudioCapture(): SystemAudioCapture {
  return {
    isSupported: () => false,
    start: async () => {
      throw new Error('System audio capture not yet implemented for this platform');
    },
    stop: async () => {}
  };
}
