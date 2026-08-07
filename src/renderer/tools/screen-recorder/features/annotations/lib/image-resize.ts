import { MIN_IMAGE_ANNOTATION_SIZE } from '../store/annotations-store';

export interface ResizeHandleDef {
  id: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  left?: true;
  right?: true;
  top?: true;
  bottom?: true;
  /** CSS `cursor` value matching this handle's drag direction. */
  cursor: string;
}

/** The 8 standard resize handles (4 corners + 4 edge midpoints), clockwise from top-left. */
export const RESIZE_HANDLES: ResizeHandleDef[] = [
  { id: 'nw', left: true, top: true, cursor: 'nwse-resize' },
  { id: 'n', top: true, cursor: 'ns-resize' },
  { id: 'ne', right: true, top: true, cursor: 'nesw-resize' },
  { id: 'e', right: true, cursor: 'ew-resize' },
  { id: 'se', right: true, bottom: true, cursor: 'nwse-resize' },
  { id: 's', bottom: true, cursor: 'ns-resize' },
  { id: 'sw', left: true, bottom: true, cursor: 'nesw-resize' },
  { id: 'w', left: true, cursor: 'ew-resize' }
];

interface Point {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}

/** Screen-space (already-scaled) point for one handle, given the image's current box. */
export function handlePointPx(
  handle: ResizeHandleDef,
  boxPx: { leftPx: number; topPx: number; widthPx: number; heightPx: number }
): Point {
  const x = handle.left
    ? boxPx.leftPx
    : handle.right
      ? boxPx.leftPx + boxPx.widthPx
      : boxPx.leftPx + boxPx.widthPx / 2;
  const y = handle.top
    ? boxPx.topPx
    : handle.bottom
      ? boxPx.topPx + boxPx.heightPx
      : boxPx.topPx + boxPx.heightPx / 2;
  return { x, y };
}

/**
 * Resizes from `base` (the annotation's position/size at drag-start) by the
 * total reference-unit delta dragged so far, preserving `aspectRatio`
 * (the image's natural width/height) -- edges opposite the dragged handle
 * stay put, matching every other resize-handle UI (PowerPoint, Keynote,
 * Figma). Corner handles derive one scale factor from whichever axis moved
 * more; edge handles (which only have one explicit axis) derive it from
 * that axis alone, and the *other*, implicit dimension resizes centered
 * (both its edges move equally) since neither of its edges was the one
 * actually dragged.
 */
export function resizeImage(
  base: { position: Point; size: Size },
  handle: ResizeHandleDef,
  dxRef: number,
  dyRef: number,
  aspectRatio: number
): { position: Point; size: Size } {
  const { width, height } = base.size;
  const widthDelta = handle.left ? -dxRef : dxRef;
  const heightDelta = handle.top ? -dyRef : dyRef;
  const scaleFromWidth = handle.left || handle.right ? (width + widthDelta) / width : null;
  const scaleFromHeight = handle.top || handle.bottom ? (height + heightDelta) / height : null;

  let scale: number;
  if (scaleFromWidth !== null && scaleFromHeight !== null) {
    scale =
      Math.abs(scaleFromWidth - 1) >= Math.abs(scaleFromHeight - 1)
        ? scaleFromWidth
        : scaleFromHeight;
  } else {
    scale = (scaleFromWidth ?? scaleFromHeight) as number;
  }
  scale = Math.max(scale, MIN_IMAGE_ANNOTATION_SIZE / Math.min(width, height));

  const newWidth = width * scale;
  const newHeight = newWidth / aspectRatio;

  let x = base.position.x;
  let y = base.position.y;
  if (handle.left) x += width - newWidth;
  else if (!handle.right) x += (width - newWidth) / 2;
  if (handle.top) y += height - newHeight;
  else if (!handle.bottom) y += (height - newHeight) / 2;

  return { position: { x, y }, size: { width: newWidth, height: newHeight } };
}
