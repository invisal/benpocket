/**
 * Plain-data contract between `timeline-evaluator.ts` (pure math, "what
 * should be on screen at this instant") and `pixi-scene-renderer.ts` (draws
 * that data with PixiJS). Keeping this a plain-data boundary -- no PixiJS
 * types here -- is what lets new effects be added without either module
 * needing to know about the other's internals.
 */

export interface InnerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BackgroundSceneData =
  | { kind: 'color'; color: string }
  | { kind: 'linear-gradient'; angleDeg: number; colors: string[] }
  | { kind: 'image'; path: string; blurPx: number };

export interface ShadowSceneData {
  radiusPx: number;
  blurPx: number;
  offsetYPx: number;
  /** 0-1 alpha of the (solid black) shadow fill. */
  alpha: number;
}

export interface ZoomSceneData {
  depth: number;
  /** Normalized (0-1) focal point within `innerRect`. */
  focal: { x: number; y: number };
  /** Normalized (0-1, fraction of innerRect size) extra pan. */
  shift: { x: number; y: number };
}

export interface CursorGhostSceneData {
  posPx: { x: number; y: number };
  alpha: number;
}

export interface CursorSceneData {
  posPx: { x: number; y: number };
  sizePx: number;
  fill: string;
  stroke: string;
  clickScale: number;
  clipToCanvas: boolean;
  ghosts: CursorGhostSceneData[];
}

export interface WebcamSceneData {
  xPx: number;
  yPx: number;
  sizePx: number;
  shape: 'circle' | 'rounded-square' | 'square';
  mirrored: boolean;
}

export interface BlurMaskSceneData {
  shape: 'rectangle' | 'ellipse';
  kind: 'blur' | 'mask';
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  color: string;
  blurPx: number;
}

export type AnnotationSceneData =
  | { kind: 'text'; id: string; xPx: number; yPx: number; text: string; fontPx: number }
  | {
      kind: 'arrow';
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      lineWidthPx: number;
      headLengthPx: number;
      dashed: boolean;
    }
  | { kind: 'image'; id: string; xPx: number; yPx: number; assetPath: string; scale: number };

export interface CaptionSceneData {
  text: string;
}

/** Everything needed to draw one output frame, resolved for a specific `atMs`. Video/webcam pixel buffers are NOT part of this -- those come from the decoder per frame and are passed separately to `renderFrame()`. */
export interface SceneDescription {
  outputWidth: number;
  outputHeight: number;
  innerRect: InnerRect;
  cornerRadiusPx: number;
  referenceScale: number;
  background: BackgroundSceneData;
  shadow: ShadowSceneData | null;
  zoom: ZoomSceneData;
  cursor: CursorSceneData | null;
  blurMasks: BlurMaskSceneData[];
  webcam: WebcamSceneData | null;
  annotations: AnnotationSceneData[];
  caption: CaptionSceneData | null;
}
