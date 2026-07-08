export type CaptureTargetType = 'screen' | 'window';

export interface CaptureSource {
  id: string;
  name: string;
  type: CaptureTargetType;
  thumbnailDataUrl: string;
  displayId?: string;
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
