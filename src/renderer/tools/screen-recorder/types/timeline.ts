export interface TimeRange {
  startMs: number;
  endMs: number;
}

export type ClipSpeed = 0.5 | 1 | 1.25 | 1.5 | 2;

/**
 * Normalized (0-1) crop rect relative to the *source recording's* native
 * pixel dimensions -- not the output/canvas dimensions, which may differ
 * (aspect ratio, resolution). `null` means "no crop, use the full frame".
 * Converted to source pixel coordinates at export time once the source's
 * actual width/height are known (see main/export/video-decoder.ts).
 *
 * Lives on `TimelineSegment` (not `Project`) because crop is a per-clip
 * setting: each cut clip can be framed differently.
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineSegment {
  id: string;
  trackId: string;
  range: TimeRange;
  speed: ClipSpeed;
  sourceOffsetMs: number;
  crop: CropRect | null;
  /**
   * Whether this clip's own in/out point has been manually dragged since it
   * was created (see `resizeSegmentEdge`) -- not set by splitting alone.
   * Purely a UI/editing-history flag (not read at export): drives the
   * sparse "Trim" indicator pill in `TrimTrack`, the same "only show a pill
   * when something's actually been done" pattern as `SpeedTrack`/`CropTrack`.
   */
  trimmed: boolean;
}

export interface TimelineTrack {
  id: string;
  kind: 'video' | 'webcam' | 'audio' | 'annotation';
  segments: TimelineSegment[];
}

export interface ZoomKeyframe {
  id: string;
  atMs: number;
  durationMs: number;
  depth: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  position: { x: number; y: number } | 'auto-cursor';
  /** Fixed ease-in/ease-out time either side of the hold -- see zoom-resolve.ts's resolveZoom. */
  holdTransitionMs: number;
}
