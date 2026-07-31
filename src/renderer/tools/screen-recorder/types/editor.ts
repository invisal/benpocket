export interface PreviewVideoController {
  readonly paused: boolean;
  readonly duration: number;
  currentTime: number;
  play(): void;
  pause(): void;
}

export interface SourceResolution {
  width: number;
  height: number;
}
