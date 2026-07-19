export type EditorTool =
  'select' | 'text' | 'label' | 'rect' | 'circle' | 'arrow' | 'blur' | 'crop';

interface AnnotationBase {
  id: string;
  /** Custom layer name; falls back to a kind-based default in the panel. */
  name?: string;
  /** Hidden layers are excluded from the stage preview and the export. */
  hidden?: boolean;
}

/** All coordinates/sizes are in source-image pixel space (scaled for display, drawn 1:1 at export). */
export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  /** Top-left corner of the text box. */
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

/** Word badge (e.g. "Before" / "After"): colored text on a translucent dark pill. */
export interface ChipAnnotation extends AnnotationBase {
  kind: 'chip';
  /** Top-left corner of the pill. */
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface LabelAnnotation extends AnnotationBase {
  kind: 'label';
  /** Center of the numbered badge. */
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
}

export interface RectAnnotation extends AnnotationBase {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

/** Ellipse inscribed in its (x, y, width, height) bounding box. */
export interface CircleAnnotation extends AnnotationBase {
  kind: 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  kind: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export interface BlurAnnotation extends AnnotationBase {
  kind: 'blur';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Gaussian blur radius in image px — used by both the CSS backdrop-filter preview and the canvas export. */
  blurRadius: number;
}

export type CaptureAnnotation =
  | TextAnnotation
  | ChipAnnotation
  | LabelAnnotation
  | RectAnnotation
  | CircleAnnotation
  | ArrowAnnotation
  | BlurAnnotation;
