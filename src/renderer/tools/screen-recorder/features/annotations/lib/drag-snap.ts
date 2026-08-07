import type { Annotation } from '@screen-recorder/types/project';

/** How close (in real screen px, independent of zoom) a dragged edge/center needs to land to a guide before it snaps. */
export const SNAP_THRESHOLD_PX = 6;

export interface BBoxPx {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
}

/** Bounding box of one or more reference-canvas-unit points -- what arrow dragging (position/to are the only geometry, no measured size) uses. */
export function pointsBBoxPx(points: { x: number; y: number }[], scale: number): BBoxPx {
  const xs = points.map((p) => p.x * scale);
  const ys = points.map((p) => p.y * scale);
  return {
    leftPx: Math.min(...xs),
    rightPx: Math.max(...xs),
    topPx: Math.min(...ys),
    bottomPx: Math.max(...ys)
  };
}

/** Bounding box for a single anchor point + a measured on-screen size -- text (bottom-left anchor, via `-translate-y-full`) and image (top-left anchor) annotations. */
export function anchoredBBoxPx(
  anchor: { x: number; y: number },
  sizePx: { width: number; height: number },
  scale: number,
  vAnchor: 'top' | 'bottom'
): BBoxPx {
  const leftPx = anchor.x * scale;
  const anchorYPx = anchor.y * scale;
  const topPx = vAnchor === 'bottom' ? anchorYPx - sizePx.height : anchorYPx;
  return { leftPx, rightPx: leftPx + sizePx.width, topPx, bottomPx: topPx + sizePx.height };
}

/** Only the fields a drag ever touches -- a plain `Partial<Annotation>` would distribute awkwardly across the `Annotation` union for little benefit. */
export interface DragPatch {
  position?: { x: number; y: number };
  to?: { x: number; y: number };
}

/**
 * Bounding box to check for snapping, given which point(s) this specific
 * drag moves (only the keys present on `patch` -- e.g. an arrow endpoint
 * drag sets just `to`, so only that point should be evaluated, not the
 * whole shaft). Text/image fall back to a zero-size point box before their
 * size has been measured (e.g. the very first pointermove).
 */
export function computeDragBBoxPx(
  base: Annotation,
  patch: DragPatch,
  scale: number,
  measuredSizePx: { width: number; height: number } | null
): BBoxPx {
  if (base.kind === 'arrow') {
    const points: { x: number; y: number }[] = [];
    if (patch.position) points.push(patch.position);
    if (patch.to) points.push(patch.to);
    return pointsBBoxPx(points, scale);
  }
  const position = patch.position ?? base.position;
  if (measuredSizePx) {
    return anchoredBBoxPx(position, measuredSizePx, scale, base.kind === 'text' ? 'bottom' : 'top');
  }
  return pointsBBoxPx([position], scale);
}

export interface AxisSnap {
  offsetPx: number;
  /** Where to draw the guide line, in the same pixel space as `offsetPx`. */
  linePx: number;
}

/** Checks a box's near edge / center / far edge along one axis against the stage's own edges/center, returning the closest match within `SNAP_THRESHOLD_PX` (or `null` if nothing's close enough). */
export function snapAxis(startPx: number, endPx: number, stageSizePx: number): AxisSnap | null {
  const centerPx = (startPx + endPx) / 2;
  const candidates: AxisSnap[] = [
    { offsetPx: 0 - startPx, linePx: 0 },
    { offsetPx: stageSizePx / 2 - centerPx, linePx: stageSizePx / 2 },
    { offsetPx: stageSizePx - endPx, linePx: stageSizePx }
  ];
  let best: AxisSnap | null = null;
  for (const candidate of candidates) {
    if (
      Math.abs(candidate.offsetPx) <= SNAP_THRESHOLD_PX &&
      (!best || Math.abs(candidate.offsetPx) < Math.abs(best.offsetPx))
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Shifts whichever point(s) are present on `patch` by the snap offset (already zero when there's no snap on that axis). */
export function applySnapOffset(
  patch: DragPatch,
  offsetXPx: number,
  offsetYPx: number,
  scale: number
): DragPatch {
  if (offsetXPx === 0 && offsetYPx === 0) return patch;
  const dx = offsetXPx / scale;
  const dy = offsetYPx / scale;
  // Only set keys that were actually present on `patch` -- e.g. an arrow
  // endpoint drag's patch has just `to`, and unconditionally including
  // `position: undefined` here would spread onto (and wipe out) the
  // annotation's real position in the store's `{ ...a, ...patch }` merge.
  const result: DragPatch = {};
  if (patch.position) result.position = { x: patch.position.x + dx, y: patch.position.y + dy };
  if (patch.to) result.to = { x: patch.to.x + dx, y: patch.to.y + dy };
  return result;
}
