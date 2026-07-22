import { findWallpaperPreset } from '@shared/wallpaper-presets';
import type {
  ArrowAnnotation,
  BackgroundConfig,
  BlurAnnotation,
  CaptureAnnotation,
  ChipAnnotation,
  CircleAnnotation,
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

/** Translucent dark pill behind a chip's text. */
export const CHIP_BG = 'rgba(0, 0, 0, 0.55)';

/** Chip pill padding/radius derived from font size — shared by the DOM preview and the canvas export so both render the same pill. */
export function chipMetrics(fontSize: number): { padX: number; padY: number; radius: number } {
  return { padX: fontSize * 0.6, padY: fontSize * 0.35, radius: fontSize * 0.3 };
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

/**
 * Constrains a creation drag's end point while the modifier key is held:
 * arrows snap to 45-degree increments (length preserved), box shapes lock to
 * a square (larger axis wins, drag direction preserved).
 */
export function lockDragEnd(
  kind: 'rect' | 'circle' | 'blur' | 'arrow',
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number } {
  const dx = endX - startX;
  const dy = endY - startY;
  if (kind === 'arrow') {
    const length = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: startX + length * Math.cos(angle), y: startY + length * Math.sin(angle) };
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: startX + Math.sign(dx || 1) * size, y: startY + Math.sign(dy || 1) * size };
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

/**
 * Where the capture sits inside a background frame: contain-fit into the
 * frame inset by `marginPct` (% of the shorter frame side), centered. Same
 * behavior as the screen-recorder's computeInnerRect, so a small capture
 * scales up to fill the frame. Shared by the live preview and the export.
 */
export function backgroundInnerRect(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  marginPct: number
): Rect {
  const margin = (marginPct / 100) * Math.min(frameWidth, frameHeight);
  const availWidth = Math.max(1, frameWidth - margin * 2);
  const availHeight = Math.max(1, frameHeight - margin * 2);
  const aspect = imageWidth / imageHeight;
  const wide = aspect > availWidth / availHeight;
  const width = wide ? availWidth : availHeight * aspect;
  const height = wide ? availWidth / aspect : availHeight;
  return {
    x: Math.round((frameWidth - width) / 2),
    y: Math.round((frameHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Default top-left for a new chip/text label in source-image coordinates.
 * Without a background: inset from the image corner. With one: inset from
 * the frame's top-left margin so the pill sits on the wallpaper — same
 * frame-space padding the export uses via {@link backgroundInnerRect}.
 */
export function defaultChipPosition(
  imageWidth: number,
  imageHeight: number,
  unit: number,
  crop: Rect | null,
  background: BackgroundConfig | null
): { x: number; y: number } {
  const pad = 16 * unit;
  if (!background) return { x: pad, y: pad };

  const viewWidth = crop?.width ?? imageWidth;
  const viewHeight = crop?.height ?? imageHeight;
  const inner = backgroundInnerRect(
    background.width,
    background.height,
    viewWidth,
    viewHeight,
    background.marginPct
  );
  const k = inner.width / viewWidth;
  const padFrame = pad * k;
  const cropX = crop?.x ?? 0;
  const cropY = crop?.y ?? 0;
  return {
    x: cropX + (padFrame - inner.x) / k,
    y: cropY + (padFrame - inner.y) / k
  };
}

/**
 * Fills the canvas with a wallpaper preset's linear gradient, converting the
 * CSS angle convention (0deg = to top, clockwise) that cssGradient() uses for
 * the live preview — mirrors screen-recorder's
 * features/export/engine/rendering/effects/background.ts.
 */
function fillWallpaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wallpaperId: string
): void {
  const preset = findWallpaperPreset(wallpaperId);
  const angleRad = (preset.angleDeg * Math.PI) / 180;
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad);
  const len = Math.max(width, height);
  const gradient = ctx.createLinearGradient(
    width / 2 - (dx * len) / 2,
    height / 2 - (dy * len) / 2,
    width / 2 + (dx * len) / 2,
    height / 2 + (dy * len) / 2
  );
  preset.colors.forEach((color, i) =>
    gradient.addColorStop(i / Math.max(1, preset.colors.length - 1), color)
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Shadow strength behind the framed capture — the screen-recorder's default intensity (40). */
export const BACKGROUND_SHADOW = {
  alpha: 0.33,
  blur: 28,
  offsetY: 12,
  /** blur/offsetY are px at this frame width; scale linearly for other sizes. */
  referenceWidth: 1920
};

/**
 * Composites the capture onto a gradient frame, then draws the annotations
 * on top in frame space — so annotations placed beyond the image edges land
 * on the background, exactly like the editor preview shows them. The corner
 * radius (in capture px) is applied to the inset image here — scaled by the
 * fit ratio — instead of on the capture canvas, so the clip edge stays crisp.
 */
function composeBackground(
  content: HTMLCanvasElement,
  annotations: CaptureAnnotation[],
  cornerRadius: number,
  background: BackgroundConfig
): HTMLCanvasElement {
  const frame = document.createElement('canvas');
  frame.width = Math.max(1, Math.round(background.width));
  frame.height = Math.max(1, Math.round(background.height));
  const ctx = frame.getContext('2d');
  if (!ctx) return content;

  const inner = backgroundInnerRect(
    frame.width,
    frame.height,
    content.width,
    content.height,
    background.marginPct
  );
  const radius = cornerRadius * (inner.width / content.width);
  // The frame's own rounding (independent of the image's) — the clip stays
  // active for everything drawn below, leaving transparent PNG corners.
  if (background.cornerRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, frame.width, frame.height, background.cornerRadius);
    ctx.clip();
  }

  fillWallpaper(ctx, frame.width, frame.height, background.wallpaper);

  // Soft drop shadow so the capture doesn't look pasted on. Opaque black
  // fill under the image, like the recorder's drawContentShadow.
  const shadowScale = frame.width / BACKGROUND_SHADOW.referenceWidth;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(inner.x, inner.y, inner.width, inner.height, radius);
  ctx.shadowColor = `rgba(0, 0, 0, ${BACKGROUND_SHADOW.alpha})`;
  ctx.shadowBlur = BACKGROUND_SHADOW.blur * shadowScale;
  ctx.shadowOffsetY = BACKGROUND_SHADOW.offsetY * shadowScale;
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(inner.x, inner.y, inner.width, inner.height, radius);
  ctx.clip();
  ctx.drawImage(content, inner.x, inner.y, inner.width, inner.height);
  ctx.restore();

  drawAnnotations(ctx, frame, annotations, inner.width / content.width, inner.x, inner.y);
  return frame;
}

/** Watermark shown in the frame's bottom-right when enabled. Shared with the live preview. */
export const BACKGROUND_WATERMARK = 'benpocket/screen-capture';

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number
): void {
  const fontSize = Math.max(12, Math.round(frameWidth * 0.012));
  const margin = Math.max(8, Math.round(frameWidth * 0.012));
  const { padX, padY, radius } = chipMetrics(fontSize);
  ctx.save();
  ctx.font = `600 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(BACKGROUND_WATERMARK).width;
  const width = textWidth + padX * 2;
  const height = fontSize + padY * 2;
  const x = frameWidth - margin - width;
  const y = frameHeight - margin - height;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = CHIP_BG;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(BACKGROUND_WATERMARK, x + padX, y + height / 2);
  ctx.restore();
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

function drawCircle(ctx: CanvasRenderingContext2D, circle: CircleAnnotation): void {
  ctx.strokeStyle = circle.color;
  ctx.lineWidth = circle.strokeWidth;
  ctx.beginPath();
  ctx.ellipse(
    circle.x + circle.width / 2,
    circle.y + circle.height / 2,
    circle.width / 2,
    circle.height / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
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

function drawChip(ctx: CanvasRenderingContext2D, chip: ChipAnnotation): void {
  const { padX, padY, radius } = chipMetrics(chip.fontSize);
  ctx.font = `600 ${Math.round(chip.fontSize)}px sans-serif`;
  const width = ctx.measureText(chip.text).width + padX * 2;
  const height = chip.fontSize + padY * 2;
  ctx.beginPath();
  ctx.roundRect(chip.x, chip.y, width, height, radius);
  ctx.fillStyle = CHIP_BG;
  ctx.fill();
  ctx.fillStyle = chip.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(chip.text, chip.x + padX, chip.y + height / 2);
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
 * Draws annotations onto `surface` with the image origin at (dx, dy) and
 * image px scaled by `k` — the identity for the bare capture, the inner-rect
 * transform when composited onto a background frame (which also lets
 * annotations extend past the image onto the frame). Annotations must
 * already be crop-shifted and visible.
 *
 * Draws in array order (last = topmost layer). A blur layer samples the
 * surface as painted so far, so it also blurs annotations stacked below it —
 * the same stacking semantics as the CSS backdrop-filter preview.
 */
function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  surface: HTMLCanvasElement,
  annotations: CaptureAnnotation[],
  k: number,
  dx: number,
  dy: number
): void {
  for (const a of annotations) {
    ctx.save();
    if (a.kind === 'blur') {
      // drawBlur reads surface pixels, and getImageData-style reads ignore
      // context transforms — so map the region into surface space by hand.
      drawBlur(ctx, surface, {
        ...a,
        x: dx + a.x * k,
        y: dy + a.y * k,
        width: a.width * k,
        height: a.height * k,
        blurRadius: a.blurRadius * k
      });
    } else {
      ctx.translate(dx, dy);
      ctx.scale(k, k);
      if (a.kind === 'rect') drawRect(ctx, a);
      else if (a.kind === 'circle') drawCircle(ctx, a);
      else if (a.kind === 'arrow') drawArrow(ctx, a);
      else if (a.kind === 'label') drawLabel(ctx, a);
      else if (a.kind === 'chip') drawChip(ctx, a);
      else drawText(ctx, a);
    }
    ctx.restore();
  }
}

/**
 * Bakes the crop, annotations, the corner-radius clip, the optional
 * background frame, and an optional watermark into a new PNG blob. Without a
 * background the output is the source image's native (cropped) resolution;
 * with one it is the frame's width x height. Returns the original blob
 * untouched when there is nothing to bake.
 */
export async function flattenImage(
  blob: Blob,
  annotations: CaptureAnnotation[],
  cornerRadius: number,
  crop: Rect | null = null,
  background: BackgroundConfig | null = null,
  watermark = false
): Promise<Blob> {
  if (annotations.length === 0 && cornerRadius <= 0 && !crop && !background && !watermark)
    return blob;

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

  // With a background, composeBackground applies the radius clip when
  // insetting the image into the frame instead — clipping here too would
  // double-round the (scaled) corners.
  if (cornerRadius > 0 && !background) {
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, cornerRadius);
    ctx.clip();
  }
  ctx.drawImage(bitmap, -ox, -oy);
  bitmap.close();

  // Annotations live in source-image coordinates; shift them into the
  // cropped output space.
  const visible = annotations
    .filter((a) => !a.hidden)
    .map((a) => (ox || oy ? shiftAnnotation(a, -ox, -oy) : a));

  // Without a background, annotations bake straight onto the capture (under
  // the corner-radius clip set above). With one, they draw onto the frame in
  // composeBackground instead, so they can overhang onto the background.
  if (!background) drawAnnotations(ctx, canvas, visible, 1, 0, 0);

  const output = background ? composeBackground(canvas, visible, cornerRadius, background) : canvas;
  if (watermark) {
    const outCtx = output.getContext('2d');
    if (outCtx) drawWatermark(outCtx, output.width, output.height);
  }
  return new Promise((resolve, reject) => {
    output.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not encode PNG.'))),
      'image/png'
    );
  });
}
