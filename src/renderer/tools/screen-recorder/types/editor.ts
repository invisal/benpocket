export interface PreviewVideoController {
  readonly paused: boolean;
  readonly duration: number;
  /** Whether the active video is still resolving an in-flight seek -- lets a caller wait for one seek to finish (see use-apply-seek-request.ts) instead of piling up a backlog of now-stale ones against a disk-backed source. */
  readonly seeking: boolean;
  currentTime: number;
  play(): void;
  pause(): void;
}

export interface SourceResolution {
  width: number;
  height: number;
}
