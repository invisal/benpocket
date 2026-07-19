import type {
  ArrowAnnotation,
  BlurAnnotation,
  CaptureAnnotation,
  LabelAnnotation,
  RectAnnotation,
  TextAnnotation
} from '../types/editor';

/** Resolution-independent sizing unit — must match editor.store.ts's `unit`. */
export function imageUnit(imageWidth: number): number {
  return Math.max(1, imageWidth / 1000);
}

export interface ArrowHead {
  hx1: number;
  hy1: number;
  hx2: number;
  hy2: number;
}

/**
 * Two arrowhead wing endpoints for an arrow ending at (x2, y2). Shared by the
 * live SVG preview and the canvas export so they always agree.
 */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  headLength: number
): ArrowHead {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return {
    hx1: x2 - headLength * Math.cos(angle - Math.PI / 6),
    hy1: y2 - headLength * Math.sin(angle - Math.PI / 6),
    hx2: x2 - headLength * Math.cos(angle + Math.PI / 6),
    hy2: y2 - headLength * Math.sin(angle + Math.PI / 6)
  };
}

export function arrowHeadLength(strokeWidth: number): number {
  return strokeWidth * 4;
}

/** Number color inside a label badge — dark on light fills, white otherwise. */
export function labelTextColor(fill: string): string {
  return fill === '#ffffff' ? '#111111' : '#ffffff';
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalizes a drag from (ax, ay) to (bx, by) into a positive-size rect. */
export function normalizeRect(ax: number, ay: number, bx: number, by: number): Rect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay)
  };
}

export type RectCorner = 'nw' | 'ne' | 'sw' | 'se';

/** Resize `start` by dragging `corner` by (dx, dy), keeping the opposite corner fixed and the size at least `minSize`. */
export function resizeRect(
  start: Rect,
  corner: RectCorner,
  dx: number,
  dy: number,
  minSize: number
): Rect {
  const movesLeft = corner === 'nw' || corner === 'sw';
  const movesTop = corner === 'nw' || corner === 'ne';
  const width = Math.max(minSize, movesLeft ? start.width - dx : start.width + dx);
  const height = Math.max(minSize, movesTop ? start.height - dy : start.height + dy);
  return {
    x: movesLeft ? start.x + start.width - width : start.x,
    y: movesTop ? start.y + start.height - height : start.y,
    width,
    height
  };
}

/** Translates an annotation by (dx, dy) in image px — used to map source-image coordinates into cropped-output coordinates. */
export function shiftAnnotation<T extends CaptureAnnotation>(a: T, dx: number, dy: number): T {
  if (a.kind === 'arrow') {
    return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
  }
  return { ...a, x: a.x + dx, y: a.y + dy };
}

/** Clamps a rect into the bounds of an image, preserving the edges that were already inside. */
export function clampRectToImage(rect: Rect, imageWidth: number, imageHeight: number): Rect {
  const x = Math.min(Math.max(0, rect.x), imageWidth);
  const y = Math.min(Math.max(0, rect.y), imageHeight);
  const right = Math.min(Math.max(x, rect.x + rect.width), imageWidth);
  const bottom = Math.min(Math.max(y, rect.y + rect.height), imageHeight);
  return { x, y, width: right - x, height: bottom - y };
}

// The editor previews regions with CSS `backdrop-filter: blur()` and this
// bakes them with `ctx.filter = 'blur()'` — the same Chromium Gaussian — so
// both read the pixel radius from the annotation to look identical.
function drawBlur(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  region: BlurAnnotation
): void {
  const blurPx = region.blurRadius;
  const x = Math.round(region.x);
  const y = Math.round(region.y);
  const width = Math.round(region.width);
  const height = Math.round(region.height);
  if (width <= 0 || height <= 0 || blurPx <= 0) return;

  // Blur a padded copy of the region, then keep only the center: the
  // Gaussian needs surrounding context (like backdrop-filter has) and the
  // padding absorbs the transparent bleed at the temp canvas edges.
  const pad = Math.ceil(blurPx * 3);
  const temp = document.createElement('canvas');
  temp.width = width + pad * 2;
  temp.height = height + pad * 2;
  const tempCtx = temp.getContext('2d');
  if (!tempCtx) return;
  tempCtx.filter = `blur(${blurPx}px)`;
  tempCtx.drawImage(
    source,
    x - pad,
    y - pad,
    temp.width,
    temp.height,
    0,
    0,
    temp.width,
    temp.height
  );
  ctx.drawImage(temp, pad, pad, width, height, x, y, width, height);
}

function drawRect(ctx: CanvasRenderingContext2D, rect: RectAnnotation): void {
  ctx.strokeStyle = rect.color;
  ctx.lineWidth = rect.strokeWidth;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: ArrowAnnotation): void {
  const { x1, y1, x2, y2 } = arrow;
  const { hx1, hy1, hx2, hy2 } = arrowHeadPoints(
    x1,
    y1,
    x2,
    y2,
    arrowHeadLength(arrow.strokeWidth)
  );
  ctx.strokeStyle = arrow.color;
  ctx.lineWidth = arrow.strokeWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.moveTo(hx1, hy1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(hx2, hy2);
  ctx.stroke();
}

function drawLabel(ctx: CanvasRenderingContext2D, label: LabelAnnotation): void {
  ctx.beginPath();
  ctx.arc(label.x, label.y, label.radius, 0, Math.PI * 2);
  ctx.fillStyle = label.color;
  ctx.fill();
  ctx.fillStyle = labelTextColor(label.color);
  ctx.font = `600 ${Math.round(label.radius * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label.value), label.x, label.y);
}

function drawText(ctx: CanvasRenderingContext2D, text: TextAnnotation): void {
  ctx.fillStyle = text.color;
  ctx.font = `500 ${Math.round(text.fontSize)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText(text.text, text.x, text.y);
  ctx.shadowColor = 'transparent';
}

/**
 * Bakes the crop, annotations, and the corner-radius clip into a new PNG blob
 * at the source image's native resolution. Returns the original blob
 * untouched when there is nothing to bake.
 */
export async function flattenImage(
  blob: Blob,
  annotations: CaptureAnnotation[],
  cornerRadius: number,
  crop: Rect | null = null
): Promise<Blob> {
  if (annotations.length === 0 && cornerRadius <= 0 && !crop) return blob;

  const bitmap = await createImageBitmap(blob);
  const ox = crop ? Math.round(crop.x) : 0;
  const oy = crop ? Math.round(crop.y) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = crop ? Math.max(1, Math.round(crop.width)) : bitmap.width;
  canvas.height = crop ? Math.max(1, Math.round(crop.height)) : bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  if (cornerRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, cornerRadius);
    ctx.clip();
  }
  ctx.drawImage(bitmap, -ox, -oy);
  bitmap.close();

  // Draw in array order (last = topmost layer). A blur layer samples the
  // canvas as painted so far, so it also blurs annotations stacked below it
  // — the same stacking semantics as the CSS backdrop-filter preview.
  // Annotations live in source-image coordinates; shift them into the
  // cropped output space rather than transforming the context, because
  // drawBlur reads canvas pixels and getImageData-style reads ignore
  // context transforms.
  for (const source of annotations) {
    if (source.hidden) continue;
    const a = ox || oy ? shiftAnnotation(source, -ox, -oy) : source;
    ctx.save();
    if (a.kind === 'blur') drawBlur(ctx, canvas, a);
    else if (a.kind === 'rect') drawRect(ctx, a);
    else if (a.kind === 'arrow') drawArrow(ctx, a);
    else if (a.kind === 'label') drawLabel(ctx, a);
    else if (a.kind === 'text') drawText(ctx, a);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not encode PNG.'))),
      'image/png'
    );
  });
}
