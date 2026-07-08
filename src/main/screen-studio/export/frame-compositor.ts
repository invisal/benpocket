import {
  createCanvas,
  loadImage,
  ImageData,
  type Canvas,
  type CanvasRenderingContext2D,
  type Image
} from 'canvas';
import type {
  Project,
  BackgroundSettings,
  Annotation
} from '@screen-studio/types/project';
import type { WebcamOptions } from '@screen-studio/types/recording';
import type { ZoomKeyframe } from '@screen-studio/types/timeline';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { findWallpaperPreset } from '@shared/wallpaper-presets';

export interface InnerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Content area inset by `background.padding` (% of the shorter output dimension), contain-fit to the source aspect ratio. */
export function computeInnerRect(
  outputWidth: number,
  outputHeight: number,
  sourceAspect: number,
  paddingPercent: number
): InnerRect {
  const pad = (paddingPercent / 100) * Math.min(outputWidth, outputHeight);
  const availWidth = Math.max(1, outputWidth - pad * 2);
  const availHeight = Math.max(1, outputHeight - pad * 2);
  const availAspect = availWidth / availHeight;

  const width = sourceAspect > availAspect ? availWidth : availHeight * sourceAspect;
  const height = sourceAspect > availAspect ? availWidth / sourceAspect : availHeight;

  return {
    x: Math.round((outputWidth - width) / 2),
    y: Math.round((outputHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function ease(t: number, easing: ZoomKeyframe['easing']): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
}

/**
 * `'auto-cursor'` keyframes fall back to a fixed center point -- no cursor
 * position is ever recorded during capture, so there's nothing to follow.
 */
function resolveZoom(
  atMs: number,
  keyframes: ZoomKeyframe[]
): { depth: number; focal: { x: number; y: number } } {
  const active = keyframes.find((k) => atMs >= k.atMs && atMs <= k.atMs + k.durationMs);
  if (!active) return { depth: 1, focal: { x: 0.5, y: 0.5 } };

  const progress = active.durationMs > 0 ? (atMs - active.atMs) / active.durationMs : 1;
  const envelope =
    progress < 0.5 ? ease(progress * 2, active.easing) : ease((1 - progress) * 2, active.easing);
  const depth = 1 + (active.depth - 1) * envelope;
  const focal = active.position === 'auto-cursor' ? { x: 0.5, y: 0.5 } : active.position;

  return { depth, focal };
}

/**
 * Fills the canvas with a linear gradient along `angleDeg`, using the same
 * angle convention as CSS `linear-gradient()` (0deg = to top, increasing
 * clockwise) so it matches the renderer's live preview exactly.
 */
function fillLinearGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angleDeg: number,
  colors: string[]
): void {
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad);
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.max(width, height);

  const gradient = ctx.createLinearGradient(
    cx - (dx * len) / 2,
    cy - (dy * len) / 2,
    cx + (dx * len) / 2,
    cy + (dy * len) / 2
  );
  const stops = colors.length > 1 ? colors : [colors[0] ?? '#000000', colors[0] ?? '#000000'];
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * node-canvas (this project's Cairo-backed `canvas` package) has no
 * `ctx.filter`/CSS-filter support, so blur is approximated the classic cheap
 * way: draw the image into a much smaller offscreen canvas (which discards
 * high-frequency detail) then scale that back up to full size. `blurPx`
 * (0-20, from the Background blur slider) maps to how small the
 * intermediate canvas is -- higher blur = smaller intermediate = blurrier.
 */
function drawBlurredImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: Image,
  blurPx: number
): void {
  const shrink = 1 + blurPx * 2.5;
  const smallWidth = Math.max(1, Math.round(width / shrink));
  const smallHeight = Math.max(1, Math.round(height / shrink));

  const small = createCanvas(smallWidth, smallHeight);
  const smallCtx = small.getContext('2d');
  const scale = Math.max(smallWidth / image.width, smallHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  smallCtx.drawImage(
    image,
    (smallWidth - drawWidth) / 2,
    (smallHeight - drawHeight) / 2,
    drawWidth,
    drawHeight
  );

  ctx.drawImage(small, 0, 0, smallWidth, smallHeight, 0, 0, width, height);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundSettings,
  image: Image | undefined
): void {
  switch (background.kind) {
    case 'color': {
      ctx.fillStyle = background.value;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'gradient': {
      // Blur has no visible effect on a flat gradient (no high-frequency
      // detail to soften), so it's intentionally only wired up for 'image'.
      const [angleDeg = '180', color1 = '#000000', color2 = '#000000'] =
        background.value.split('|');
      fillLinearGradient(ctx, width, height, Number(angleDeg), [color1, color2]);
      break;
    }
    case 'wallpaper': {
      const preset = findWallpaperPreset(background.value);
      fillLinearGradient(ctx, width, height, preset.angleDeg, preset.colors);
      break;
    }
    case 'image': {
      if (image) {
        if (background.blur > 0) {
          drawBlurredImage(ctx, width, height, image, background.blur);
        } else {
          const scale = Math.max(width / image.width, height / image.height);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          ctx.drawImage(
            image,
            (width - drawWidth) / 2,
            (height - drawHeight) / 2,
            drawWidth,
            drawHeight
          );
        }
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }
  }
}

function drawWebcamPlaceholder(
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  webcam: WebcamOptions
): void {
  if (!webcam.enabled) return;
  const scale = outputWidth / REFERENCE_CANVAS_WIDTH;
  const x = webcam.position.x * scale;
  const y = webcam.position.y * scale;
  const size = webcam.size * scale;

  ctx.save();
  ctx.beginPath();
  if (webcam.shape === 'circle') {
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  } else if (webcam.shape === 'rounded-square') {
    ctx.roundRect(x, y, size, size, size * 0.16);
  } else {
    ctx.rect(x, y, size, size);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(20, 20, 24, 0.9)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.015);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.stroke();
  ctx.restore();
}

function isAnnotationActive(atMs: number, annotation: Annotation): boolean {
  return atMs >= annotation.atMs && atMs <= annotation.atMs + annotation.durationMs;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  scale: number
): void {
  const headLength = 14 * scale;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  annotations: Annotation[],
  atMs: number,
  images: Map<string, Image>
): void {
  const scale = outputWidth / REFERENCE_CANVAS_WIDTH;
  for (const annotation of annotations) {
    if (!isAnnotationActive(atMs, annotation)) continue;
    const x = annotation.position.x * scale;
    const y = annotation.position.y * scale;

    if (annotation.kind === 'text') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(28 * scale)}px sans-serif`;
      ctx.fillText(annotation.text, x, y);
    } else if (annotation.kind === 'arrow') {
      drawArrow(ctx, x, y, annotation.to.x * scale, annotation.to.y * scale, scale);
    } else if (annotation.kind === 'image') {
      const image = images.get(annotation.assetPath);
      if (image) ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
    }
  }
}

/**
 * Composites one output frame at a time. Reuses a single output canvas and a
 * single scratch canvas (sized to the inner content rect) across every frame
 * of an export to avoid per-frame allocation.
 */
export class FrameCompositor {
  private readonly canvas: Canvas;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scratch: Canvas;
  private readonly scratchCtx: CanvasRenderingContext2D;
  private backgroundImage: Image | undefined;
  private readonly annotationImages = new Map<string, Image>();

  private constructor(
    private readonly outputWidth: number,
    private readonly outputHeight: number,
    private readonly innerRect: InnerRect
  ) {
    this.canvas = createCanvas(outputWidth, outputHeight);
    this.ctx = this.canvas.getContext('2d');
    this.scratch = createCanvas(innerRect.width, innerRect.height);
    this.scratchCtx = this.scratch.getContext('2d');
  }

  static async create(
    outputWidth: number,
    outputHeight: number,
    sourceAspect: number,
    project: Project
  ): Promise<FrameCompositor> {
    const innerRect = computeInnerRect(
      outputWidth,
      outputHeight,
      sourceAspect,
      project.background.padding
    );
    const compositor = new FrameCompositor(outputWidth, outputHeight, innerRect);

    // Only 'image' loads a user file -- 'wallpaper' is a bundled gradient
    // preset rendered procedurally by fillLinearGradient, no image I/O needed.
    if (project.background.kind === 'image') {
      compositor.backgroundImage = await loadImage(project.background.value).catch(() => undefined);
    }
    for (const annotation of project.annotations) {
      if (annotation.kind === 'image' && !compositor.annotationImages.has(annotation.assetPath)) {
        const image = await loadImage(annotation.assetPath).catch(() => undefined);
        if (image) compositor.annotationImages.set(annotation.assetPath, image);
      }
    }
    return compositor;
  }

  getInnerRect(): InnerRect {
    return this.innerRect;
  }

  /** Draws one frame and returns the composited RGBA pixel buffer. */
  composite(project: Project, atMs: number, decodedFrame: Buffer): Buffer {
    const { ctx, scratchCtx, innerRect, outputWidth, outputHeight } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(ctx, outputWidth, outputHeight, project.background, this.backgroundImage);

    const { depth, focal } = resolveZoom(atMs, project.zoomKeyframes);
    const focalPx = {
      x: innerRect.x + focal.x * innerRect.width,
      y: innerRect.y + focal.y * innerRect.height
    };

    ctx.save();
    ctx.translate(focalPx.x, focalPx.y);
    ctx.scale(depth, depth);
    ctx.translate(-focalPx.x, -focalPx.y);

    // putImageData ignores the current transform, so the decoded frame is
    // written to an untransformed scratch canvas first, then drawImage'd
    // onto the (zoom-transformed) main context -- drawImage respects
    // transforms, putImageData does not.
    const clamped = new Uint8ClampedArray(
      decodedFrame.buffer,
      decodedFrame.byteOffset,
      decodedFrame.byteLength
    );
    scratchCtx.putImageData(new ImageData(clamped, innerRect.width, innerRect.height), 0, 0);
    ctx.drawImage(this.scratch, innerRect.x, innerRect.y, innerRect.width, innerRect.height);
    ctx.restore();

    // Webcam/annotations are drawn untransformed so content zoom doesn't
    // affect them (matches a fixed on-top PiP/overlay, not part of the scene).
    drawWebcamPlaceholder(ctx, outputWidth, project.webcam);
    drawAnnotations(ctx, outputWidth, project.annotations, atMs, this.annotationImages);

    // No cursor overlay: nothing in the capture pipeline records a cursor
    // position track, so there is no real path to draw.

    // getImageData (not canvas.toBuffer('raw')) guarantees RGBA byte order
    // matching the pix_fmt declared to the encoder, regardless of platform.
    return Buffer.from(ctx.getImageData(0, 0, outputWidth, outputHeight).data);
  }
}
