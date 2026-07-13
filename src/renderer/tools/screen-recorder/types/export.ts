import type { ClipSpeed, CropRect, TimeRange } from './timeline';
import type { Project } from './project';

export type ExportFormat = 'mp4' | 'webm' | 'mov' | 'gif';
export type ExportCodec = 'h264' | 'h265' | 'av1';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

/** One kept clip: its source range, crop, and speed (all per-clip, not global). */
export interface ExportSegment {
  range: TimeRange;
  crop: CropRect | null;
  speed: ClipSpeed;
}

export interface ExportOptions {
  format: ExportFormat;
  codec: ExportCodec;
  aspectRatio: AspectRatio;
  resolution: { width: number; height: number };
  frameRate: number;
  quality: number;
  outputPath: string;
  /** Absolute path to the recorded source file (lastRecording.filePath). */
  sourceVideoPath: string;
  /**
   * Ordered list of kept clips -- the output is each clip's range decoded
   * (cropped to that clip's own rect), scaled, and concatenated in array
   * order. This is what actually encodes "cut out the middle", "reorder
   * clips", and "crop this clip differently than that one". A plain
   * single-range export with no crop is just the one-element,
   * `crop: null` special case.
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
