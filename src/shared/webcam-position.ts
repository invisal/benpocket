import { REFERENCE_CANVAS_WIDTH } from './constants';

/**
 * `WebcamOptions.position` is an absolute `{x,y}` offset in
 * `REFERENCE_CANVAS_WIDTH`-scaled reference units, anchored to the stage's
 * top-left corner -- but `REFERENCE_CANVAS_WIDTH` only fixes a reference
 * *width*; the reference *height* the same units are measured against is
 * `REFERENCE_CANVAS_WIDTH / aspectRatioValue`, which changes with the
 * project's aspect ratio. A position that was on-stage at `16:9` can land
 * far outside a `9:16` stage's much shorter reference height with the
 * stored value completely unchanged, clipped away by the stage's own
 * `overflow: hidden` -- reading as "the webcam disappeared" until it's
 * manually dragged back. Clamped here (at render time, in both the live
 * preview and the export renderer) rather than by reacting to aspect-ratio
 * changes and rewriting the stored position, so an already-valid position
 * is never perturbed and dragging still starts from wherever the webcam is
 * actually showing.
 */
export function clampWebcamPosition(
  position: { x: number; y: number },
  sizeUnits: number,
  referenceHeight: number
): { x: number; y: number } {
  const maxX = Math.max(0, REFERENCE_CANVAS_WIDTH - sizeUnits);
  const maxY = Math.max(0, referenceHeight - sizeUnits);
  return {
    x: Math.min(Math.max(position.x, 0), maxX),
    y: Math.min(Math.max(position.y, 0), maxY)
  };
}
