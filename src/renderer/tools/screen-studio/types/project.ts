import type { TimelineTrack, ZoomKeyframe } from './timeline';
import type { WebcamOptions } from './recording';

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
}

export interface CursorSettings {
  theme: string;
  size: number;
  smoothing: number;
  clickEffect: 'none' | 'ripple' | 'highlight';
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
  captions: CaptionSettings;
  annotations: Annotation[];
  motionBlur: boolean;
}
