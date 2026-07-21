import type { Container } from 'pixi.js';
import type { InnerRect, ZoomSceneData } from '../types';

/**
 * Applies `ResolvedZoom` (`@shared/zoom-resolve`) as a container transform.
 * Equivalent to frame-compositor.ts's
 * `translate(shift)→translate(focal)→scale(depth)→translate(-focal)`
 * chain: pivoting on the focal point and re-positioning by `focal + shift`
 * produces the identical result with Pixi's position/pivot/scale model.
 */
export function applyZoom(container: Container, innerRect: InnerRect, zoom: ZoomSceneData): void {
  const focalPx = {
    x: innerRect.x + zoom.focal.x * innerRect.width,
    y: innerRect.y + zoom.focal.y * innerRect.height
  };
  const shiftPx = {
    x: zoom.shift.x * innerRect.width,
    y: zoom.shift.y * innerRect.height
  };
  container.pivot.set(focalPx.x, focalPx.y);
  container.position.set(focalPx.x + shiftPx.x, focalPx.y + shiftPx.y);
  container.scale.set(zoom.depth, zoom.depth);
}
