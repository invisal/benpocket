export interface TimeRange {
  startMs: number;
  endMs: number;
}

export type ClipSpeed = 0.5 | 1 | 1.25 | 1.5 | 2;
export const CLIP_SPEED_OPTIONS: ClipSpeed[] = [0.5, 1, 1.25, 1.5, 2];

/**
 * Normalized (0-1) crop rect relative to the *source recording's* native
 * pixel dimensions -- not the output/canvas dimensions, which may differ
 * (aspect ratio, resolution). `null` means "no crop, use the full frame".
 * Converted to source pixel coordinates at export time once the source's
 * actual width/height are known (see main/export/video-decoder.ts).
 *
 * A single crop applies to the whole recording (see `useCropStore`), not
 * per-clip -- every kept segment is decoded through the same rect.
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
  /**
   * `range` as it was the moment this segment was created (by
   * `initializeFromDuration` or, for a split result, by `splitAt` itself) --
   * never mutated afterward. `resizeSegmentEdge` only ever writes `range`,
   * so this is what "Reset trim" restores back to.
   */
  originalRange: TimeRange;
  speed: ClipSpeed;
  sourceOffsetMs: number;
  /**
   * Whether this clip's own in/out point has been manually dragged since it
   * was created (see `resizeSegmentEdge`) -- not set by splitting alone.
   * Drives the sparse "Trim" indicator pill in `TrimTrack` and gates the
   * context menu's "Reset trim" action.
   */
  trimmed: boolean;
  /**
   * Set on both halves produced by `splitAt` (never on a freshly-loaded
   * recording's single starting segment). Once true, the clip's in/out
   * points are locked -- the cut that created it is final, so neither
   * timeline edge-drag nor the settings panel's Start/End fields may move
   * its range further. Re-splitting a locked segment is still allowed (the
   * resulting pieces are locked too); only trimming is blocked.
   */
  split: boolean;
  /** Hides the mouse cursor overlay (in both preview and export) for this clip's own duration -- independent of the global `CursorSettings.visible` toggle, which hides it everywhere. Set via the timeline's per-clip "Hide mouse cursor" context menu item. */
  cursorHidden: boolean;
  /** Hides the webcam PiP overlay (in both preview and export) for this clip's own duration -- independent of the global `WebcamOptions.enabled` toggle, which hides it everywhere. Set via the timeline's per-clip "Hide webcam" context menu item. */
  webcamHidden: boolean;
  /** Silences this clip's own duration, in both preview and export. Set via the timeline's per-clip "Mute clip" context menu item -- there's no separate global mute; the export just skips audio entirely if every kept clip ends up muted (see `useExportAction.ts`). */
  audioMuted: boolean;
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
  /** Off but not deleted -- `resolveZoom` skips it entirely, in both the editor preview and export. */
  enabled: boolean;
}
