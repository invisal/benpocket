import type { CropRect } from '@screen-recorder/types/timeline';

/** Crop rect in the *source's* native pixel coordinates (not normalized). */
export interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts a normalized (0-1) `TimelineSegment.crop` rect (per-clip, not
 * global) into source pixel coordinates, clamped to the source's actual
 * bounds and rounded to even numbers. Applied as a PixiJS texture `frame`
 * (sub-rect sampling of the full decoded `VideoFrame`) rather than as a
 * decode-time filter -- there's no ffmpeg filter graph in this pipeline, the
 * full native frame is always what WebCodecs decodes.
 */
export function resolveCropRect(
  crop: CropRect | null,
  sourceWidth: number,
  sourceHeight: number
): PixelCropRect | undefined {
  if (!crop) return undefined;

  const toEven = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);

  const x = Math.round(Math.min(Math.max(crop.x, 0), 1) * sourceWidth);
  const y = Math.round(Math.min(Math.max(crop.y, 0), 1) * sourceHeight);
  const width = toEven(Math.min(crop.width, 1) * sourceWidth);
  const height = toEven(Math.min(crop.height, 1) * sourceHeight);

  return {
    x: Math.min(x, sourceWidth - width),
    y: Math.min(y, sourceHeight - height),
    width,
    height
  };
}

/**
 * Largest even-sided square centered in a `width x height` frame -- used to
 * crop a typically-16:9 webcam feed down to the square the PiP shape (see
 * effects/webcam.ts) is clipped from.
 */
export function centerSquareCrop(width: number, height: number): PixelCropRect {
  const toEven = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);
  const side = toEven(Math.min(width, height));
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side
  };
}
