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
  Annotation,
  CursorSettings
} from '@screen-recorder/types/project';
import type { WebcamOptions } from '@screen-recorder/types/recording';
import type { CursorPathPoint } from '@shared/cursor-path';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { findWallpaperPreset } from '@shared/wallpaper-presets';
import { smoothCursorPath, sampleCursorPath, resolveClickBounceScale } from '@shared/cursor-path';
import { resolveCursorStyle, CURSOR_SIZE_UNIT_PX } from '@shared/cursor-styles';
import { resolveZoom } from '@shared/zoom-resolve';

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

/**
 * Casts a soft drop shadow from a rounded-rect the size of the content
 * (`innerRect`), matching the live preview's `box-shadow` on the video
 * wrapper (see PreviewStage.tsx's `contentBoxShadow`) -- drawn *before* the
 * zoom transform so the shadow stays anchored to the content's rest
 * position rather than panning or scaling along with it.
 */
function drawContentShadow(
  ctx: CanvasRenderingContext2D,
  rect: InnerRect,
  radiusPx: number,
  intensity: number,
  scale: number
): void {
  if (intensity <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radiusPx);
  ctx.shadowColor = `rgba(0, 0, 0, ${(0.15 + (intensity / 100) * 0.45).toFixed(2)})`;
  ctx.shadowBlur = intensity * 0.7 * scale;
  ctx.shadowOffsetY = intensity * 0.3 * scale;
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
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

/** Same path data as CursorStyleIcon.tsx's SVG, authored in a 24x24 box. */
function traceCursorIconPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(5, 3);
  ctx.lineTo(5, 20.5);
  ctx.lineTo(9.5, 16.2);
  ctx.lineTo(12.3, 21.8);
  ctx.lineTo(15, 20.4);
  ctx.lineTo(12.1, 14.8);
  ctx.lineTo(18.5, 14.5);
  ctx.closePath();
}

function drawCursorIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sizePx: number,
  fill: string,
  stroke: string,
  alpha: number,
  clickScale = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(sizePx / 24, sizePx / 24);
  if (clickScale !== 1) {
    // Click-bounce scales around the glyph's own tip (5,3 of its 24x24 box,
    // see traceCursorIconPath) rather than (0,0), so it reads as the cursor
    // squashing at the click point instead of visibly shifting position.
    ctx.translate(5, 3);
    ctx.scale(clickScale, clickScale);
    ctx.translate(-5, -3);
  }
  traceCursorIconPath(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws the recorded cursor (already smoothed once, in the caller, since
 * smoothing doesn't depend on `atMs`). Position is mapped through
 * `innerRect` exactly like the zoom focal point; the caller draws this
 * *inside* the zoom-transformed block so the cursor pans/scales with the
 * content, matching a real on-screen cursor rather than a fixed overlay.
 */
function drawCursor(
  ctx: CanvasRenderingContext2D,
  outputWidth: number,
  innerRect: InnerRect,
  cursor: CursorSettings,
  smoothedPath: CursorPathPoint[],
  clickPath: CursorPathPoint[],
  atMs: number
): void {
  if (!cursor.visible || smoothedPath.length === 0) return;
  const point = sampleCursorPath(smoothedPath, atMs);
  if (!point) return;
  const clickScale = resolveClickBounceScale(clickPath, atMs, cursor.clickBounce);

  const scale = outputWidth / REFERENCE_CANVAS_WIDTH;
  const sizePx = cursor.size * CURSOR_SIZE_UNIT_PX * scale;
  const preset = resolveCursorStyle(cursor.style);

  ctx.save();
  if (cursor.clipToCanvas) {
    ctx.beginPath();
    ctx.rect(innerRect.x, innerRect.y, innerRect.width, innerRect.height);
    ctx.clip();
  }

  // Motion blur: a handful of trailing ghost copies sampled a little earlier
  // on the path, fading out -- `motionBlur` (0-1) controls both the trail's
  // reach (how far back in time it samples) and its opacity.
  if (cursor.motionBlur > 0) {
    const ghostCount = 4;
    for (let i = ghostCount; i >= 1; i--) {
      const ghostAtMs = atMs - i * 14 * cursor.motionBlur;
      const ghostPoint = sampleCursorPath(smoothedPath, ghostAtMs);
      if (!ghostPoint) continue;
      const alpha = cursor.motionBlur * 0.12 * (1 - i / (ghostCount + 1));
      drawCursorIcon(
        ctx,
        innerRect.x + ghostPoint.x * innerRect.width,
        innerRect.y + ghostPoint.y * innerRect.height,
        sizePx,
        preset.fill,
        preset.stroke,
        alpha
      );
    }
  }

  drawCursorIcon(
    ctx,
    innerRect.x + point.x * innerRect.width,
    innerRect.y + point.y * innerRect.height,
    sizePx,
    preset.fill,
    preset.stroke,
    1,
    clickScale
  );
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
  private smoothedCursorPath: CursorPathPoint[] = [];
  private clickPath: CursorPathPoint[] = [];

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
    // Smoothing doesn't depend on `atMs`, so it's computed once up front
    // rather than per frame.
    compositor.smoothedCursorPath = smoothCursorPath(project.cursorPath, project.cursor.smoothing);
    // Clicks are discrete events, not a continuous path -- used raw, never smoothed.
    compositor.clickPath = project.clickPath;

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

    // Authored in REFERENCE_CANVAS_WIDTH units (same convention as cursor/
    // webcam sizing) so it reads as the same physical size regardless of
    // export resolution.
    const referenceScale = outputWidth / REFERENCE_CANVAS_WIDTH;
    const cornerRadiusPx = project.background.cornerRadius * referenceScale;

    const { depth, focal, shift } = resolveZoom(
      atMs,
      project.zoomKeyframes,
      this.smoothedCursorPath
    );
    const focalPx = {
      x: innerRect.x + focal.x * innerRect.width,
      y: innerRect.y + focal.y * innerRect.height
    };

    ctx.save();
    // `shift` recenters the focal point toward the middle of the frame as
    // the zoom deepens -- applied as a flat translate *outside* the
    // focal-anchored scale below, so it just carries the whole (already
    // correctly zoomed) scene to the recentered position rather than
    // affecting the scale math itself.
    ctx.translate(shift.x * innerRect.width, shift.y * innerRect.height);
    ctx.translate(focalPx.x, focalPx.y);
    ctx.scale(depth, depth);
    ctx.translate(-focalPx.x, -focalPx.y);

    // Drawn *inside* the zoom transform, using the same (un-zoomed) innerRect
    // coordinates as the clip/video below -- so the shadow rides along with
    // the zoom exactly like the video does (matching the live preview, where
    // box-shadow lives on the same element that's `transform: scale()`'d --
    // see PreviewStage.tsx's videoWrapperRef). It also has to stay congruent
    // with the video for a less obvious reason: `drawContentShadow`'s fill is
    // solid opaque black, not just a blurred penumbra, so anywhere it isn't
    // exactly covered by the video drawn right after it shows through as a
    // black patch. Drawing it at a *fixed* rest position (the previous
    // behavior) broke that guarantee the moment `shift` panned the video
    // toward the frame center for an off-center focal point, since the
    // shadow no longer moved to match -- exposing solid black at whichever
    // edge the video shifted away from.
    drawContentShadow(ctx, innerRect, cornerRadiusPx, project.background.shadow, referenceScale);

    // Clip to the content's rounded-rect *after* the zoom transform above,
    // using the same (un-zoomed) innerRect coordinates -- the clip path
    // itself then rides along with the current transform, growing/panning
    // with the zoomed content exactly like the preview, where border-radius
    // lives on the same element that's `transform: scale()`'d (see
    // PreviewStage.tsx's videoWrapperRef) rather than on a separate fixed
    // frame. Clipping at the *pre*-zoom rect here would instead crop zoomed
    // content back into the tiny original frame, cutting off exactly what
    // the preview lets bleed outward into the padding.
    ctx.beginPath();
    ctx.roundRect(innerRect.x, innerRect.y, innerRect.width, innerRect.height, cornerRadiusPx);
    ctx.clip();

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

    // Drawn inside the zoom transform (before restore) so the cursor pans
    // and scales with the content -- it's part of the recorded scene, not a
    // fixed overlay.
    drawCursor(
      ctx,
      outputWidth,
      innerRect,
      project.cursor,
      this.smoothedCursorPath,
      this.clickPath,
      atMs
    );
    ctx.restore();

    // Webcam/annotations are drawn untransformed so content zoom doesn't
    // affect them (matches a fixed on-top PiP/overlay, not part of the scene).
    drawWebcamPlaceholder(ctx, outputWidth, project.webcam);
    drawAnnotations(ctx, outputWidth, project.annotations, atMs, this.annotationImages);

    // getImageData (not canvas.toBuffer('raw')) guarantees RGBA byte order
    // matching the pix_fmt declared to the encoder, regardless of platform.
    return Buffer.from(ctx.getImageData(0, 0, outputWidth, outputHeight).data);
  }
}
