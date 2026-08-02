import type { ClipSpeed, CropRect, TimeRange } from './timeline';
import type { Project } from './project';

export type ExportFormat = 'mp4' | 'webm' | 'mov' | 'gif';
export type ExportCodec = 'h264' | 'h265' | 'av1';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

/** One kept clip: its source range, speed, cursor/webcam visibility, and audio mute/volume (all per-clip, not global). */
export interface ExportSegment {
  range: TimeRange;
  speed: ClipSpeed;
  cursorHidden: boolean;
  webcamHidden: boolean;
  /** When true, this clip's own stretch of the output audio track is silence -- see `AudioProcessor.processMutedSegment`. */
  audioMuted: boolean;
  /** Gain applied to this clip's own audio, 0.1-1 -- see `AudioProcessor.reencodeAndMux`. Irrelevant when `audioMuted`. */
  audioVolume: number;
}

export interface ExportOptions {
  format: ExportFormat;
  codec: ExportCodec;
  aspectRatio: AspectRatio;
  resolution: { width: number; height: number };
  frameRate: number;
  quality: number;
  /** When false, skips audio processing entirely -- the export has no audio track. Derived from whether any kept clip is unmuted (see `useExportAction.ts`), not a standalone user toggle. */
  includeAudio: boolean;
  outputPath: string;
  /** Absolute path to the recorded source file (lastRecording.filePath). */
  sourceVideoPath: string;
  /** Single crop applied to the whole recording -- `null` means the full source frame. */
  crop: CropRect | null;
  /**
   * Ordered list of kept clips -- the output is each clip's range decoded
   * (cropped to `crop`), scaled, and concatenated in array order. This is
   * what actually encodes "cut out the middle" and "reorder clips".
   */
  segments: ExportSegment[];
  /** Project snapshot (background/webcam/zoom/cursor/annotations) to composite. */
  project: Project;
}

export interface ExportProgress {
  percent: number;
  stage: 'rendering' | 'encoding' | 'done' | 'error';
  error?: string;
}
