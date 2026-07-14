import type { TimelineTrack, ZoomKeyframe } from './timeline';
import type { WebcamOptions } from './recording';
import type { CursorPathPoint } from '@shared/cursor-path';

export type { CursorPathPoint };

export interface BackgroundSettings {
  kind: 'wallpaper' | 'color' | 'gradient' | 'image';
  /**
   * Meaning depends on `kind`: a wallpaper preset id (see
   * `shared/wallpaper-presets.ts`) for 'wallpaper', a CSS hex color for
   * 'color', `"<angleDeg>|<color1>|<color2>"` for 'gradient', or an image
   * file path/URL for 'image'.
   */
  value: string;
  padding: number;
  /** 0-20px Gaussian blur applied to the background layer only (behind the recording). */
  blur: number;
  /** 0-40, in `REFERENCE_CANVAS_WIDTH` units -- corner radius of the recording itself (not the background). */
  cornerRadius: number;
  /** 0-100 intensity of the drop shadow cast by the recording onto the background; 0 disables it. */
  shadow: number;
}

export interface CursorSettings {
  /** Whether the cursor overlay is drawn at all, in preview and export. */
  visible: boolean;
  /** Hide the cursor whenever it strays outside the recorded canvas bounds. */
  clipToCanvas: boolean;
  /** id into `CURSOR_STYLE_PRESETS` (@shared/cursor-styles). */
  style: string;
  /** Icon size in reference-canvas units, see CURSOR_SIZE_UNIT_PX. */
  size: number;
  /** 0 (raw/jittery) - 1 (max smoothing) applied to the recorded path. */
  smoothing: number;
  /** 0-1 intensity of the motion-blur trail drawn behind fast cursor movement. */
  motionBlur: number;
  /** 0-5 intensity of the squash/bounce animation played on click -- see `Project.clickPath` for the click data this reads. */
  clickBounce: number;
}

export interface CaptionSettings {
  enabled: boolean;
  language: string;
  segments: { id: string; startMs: number; endMs: number; text: string }[];
}

export interface AnnotationBase {
  id: string;
  atMs: number;
  durationMs: number;
  position: { x: number; y: number };
}

export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  text: string;
  animationPreset: string;
}

export interface ArrowAnnotation extends AnnotationBase {
  kind: 'arrow';
  to: { x: number; y: number };
  /** CSS hex color for the shaft/head stroke. */
  color: string;
  /** Stroke width, in REFERENCE_CANVAS_WIDTH units (same convention as position). */
  thickness: number;
  style: 'solid' | 'dashed';
}

export interface ImageAnnotation extends AnnotationBase {
  kind: 'image';
  assetPath: string;
}

export type Annotation = TextAnnotation | ArrowAnnotation | ImageAnnotation;

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceVideoPath: string;
  durationMs: number;
  tracks: TimelineTrack[];
  zoomKeyframes: ZoomKeyframe[];
  webcam: WebcamOptions;
  background: BackgroundSettings;
  cursor: CursorSettings;
  /** Recorded system-cursor samples for `sourceVideoPath`, source-timeline `atMs`. Empty when the source was a 'window' capture (no display bounds to normalize against) or tracking failed. */
  cursorPath: CursorPathPoint[];
  /** Recorded real mousedown events, same convention as `cursorPath` -- drives `cursor.clickBounce`. */
  clickPath: CursorPathPoint[];
  captions: CaptionSettings;
  annotations: Annotation[];
  motionBlur: boolean;
}
