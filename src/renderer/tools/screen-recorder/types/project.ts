import type { CropRect, TimelineTrack, ZoomKeyframe } from './timeline';
import type { WebcamOptions } from './recording';
import type { CursorPathPoint, WindowResizeSample } from '@shared/cursor-path';

export type { CursorPathPoint, WindowResizeSample };

export interface BackgroundSettings {
  /** Off means the video fills the frame edge-to-edge at its own native aspect ratio -- no padding, no wallpaper/color/gradient/image layer, no corner radius or shadow. `kind`/`value`/`padding`/`blur`/`cornerRadius`/`shadow` stay in state so re-enabling restores whatever was set before. */
  enabled: boolean;
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
  /** Whether the expanding click-ripple ring (resolveClickRipple, cursor-path.ts) draws at all -- independent of `clickBounce`'s own icon squash/pop, which stays on regardless. Off by default. */
  clickRippleEnabled: boolean;
  /** Whether a short synthesized "click" sound plays on each recorded mousedown, both in the live preview and baked into exported audio -- see `@shared/click-sound`. Reuses `clickBounce` as its intensity, same as `clickRippleEnabled` does. Off by default. */
  clickSoundEnabled: boolean;
  /** Whether resolveCursorGesture's hover/drag hand icon can ever show at all -- off means the cursor stays the plain arrow the entire time, regardless of what the recording's click/movement data would otherwise infer. On by default. */
  handGestureEnabled: boolean;
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
  /** Off but not deleted -- skipped entirely in both the editor preview and export, same as `ZoomKeyframe.enabled`. */
  enabled: boolean;
}

export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  text: string;
  animationPreset: string;
  /** Multiplier applied to the entrance/exit animation's own duration -- 1 = normal speed, 2 = twice as fast. */
  animationSpeed: number;
  /** CSS hex color for the text fill. */
  color: string;
  /** CSS hex color for the pill behind the text, or `null` for no background. */
  backgroundColor: string | null;
  /** Font size, in `REFERENCE_CANVAS_WIDTH` units (same convention as position/thickness). */
  fontSize: number;
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
  /** Rendered size, in REFERENCE_CANVAS_WIDTH units -- `null` means "use the image's natural size" (new annotations start with an explicit default instead, see DEFAULT_IMAGE_SIZE; `null` is reachable again via "Reset size"). */
  size: { width: number; height: number } | null;
}

export type Annotation = TextAnnotation | ArrowAnnotation | ImageAnnotation;

export interface BlurMaskRegion {
  id: string;
  atMs: number;
  durationMs: number;
  kind: 'blur' | 'mask';
  shape: 'rectangle' | 'ellipse';
  /**
   * Normalized (0-1) rect relative to the *original, uncropped* source
   * recording's native pixel dimensions -- same convention as `CropRect`.
   * Mapped naively onto `innerRect` at export time (not re-projected into
   * per-segment crop-local space), matching how cursor/zoom data is already
   * handled -- see frame-compositor.ts's `drawBlurMasks`.
   */
  rect: CropRect;
  /** 0-20 blur intensity, same raw (unscaled) shrink-factor convention as `BackgroundSettings.blur` -- used when kind === 'blur'. */
  intensity: number;
  /** Solid fill color -- used when kind === 'mask'. */
  color: string;
  /** Off but not deleted -- skipped entirely in both the editor preview and export, same as `ZoomKeyframe.enabled`/`AnnotationBase.enabled`. */
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Which flow produced this project -- 'recorded' projects own their video files (deleting the project deletes them too); 'imported' projects merely reference a file the user owns elsewhere on disk, which delete must never touch. */
  source: 'recorded' | 'imported';
  sourceVideoPath: string;
  /**
   * What export should read instead of `sourceVideoPath`, when it differs --
   * same file (and same reasoning) as `LastRecording.exportSourceFilePath`
   * in screen-recorder-store.ts, persisted here so it survives past the
   * live recording session: without this, reopening a saved project loses
   * track of this file entirely -- export silently falls back to the
   * duration-patched `sourceVideoPath` instead of the untouched source, and
   * the file itself becomes permanently unreferenced (deleting the project
   * can't clean up what it never knew existed). `undefined`/`null` for
   * projects saved before this field existed, or where recording never
   * produced a separate file -- callers fall back to `sourceVideoPath`.
   */
  exportSourceVideoPath?: string | null;
  durationMs: number;
  tracks: TimelineTrack[];
  zoomKeyframes: ZoomKeyframe[];
  webcam: WebcamOptions;
  /** Absolute path to the parallel webcam recording (see capture-engine.ts's `CaptureRequest.webcam`), or null if none was recorded. */
  webcamVideoPath: string | null;
  /** `exportSourceVideoPath`'s own doc, same reasoning for the webcam file. */
  webcamExportSourceVideoPath?: string | null;
  /** `webcamStartedAt - startedAt` at record time -- added to a `sourceVideoPath`-timeline `atMs` to find the corresponding moment in `webcamVideoPath`. */
  webcamOffsetMs: number;
  background: BackgroundSettings;
  cursor: CursorSettings;
  /** Recorded system-cursor samples for `sourceVideoPath`, source-timeline `atMs`. Empty when the source was a 'window' capture (no display bounds to normalize against) or tracking failed. */
  cursorPath: CursorPathPoint[];
  /** Recorded real mousedown events, same convention as `cursorPath` -- drives `cursor.clickBounce`. */
  clickPath: CursorPathPoint[];
  /** Real observed window-bounds changes (see window-bounds-poller.ts) -- lets `resolveCursorGesture` (@shared/cursor-path) know for a fact when the tracked window is actually being resized, instead of guessing from cursor movement. Only ever populated for a window-source recording with live bounds tracking; empty for a screen/full-screen recording or one saved before this field existed. */
  resizePath: WindowResizeSample[];
  captions: CaptionSettings;
  annotations: Annotation[];
  blurMasks: BlurMaskRegion[];
  motionBlur: boolean;
  /** Single crop for the whole recording, or `null` for none -- see `useCropStore`. */
  crop: CropRect | null;
}

/** Lightweight listing entry for `project:list` -- just enough to render a picker, without reading every project's full tracks/annotations/paths off disk. */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  durationMs: number;
  sourceVideoPath: string;
  source: 'recorded' | 'imported';
}
