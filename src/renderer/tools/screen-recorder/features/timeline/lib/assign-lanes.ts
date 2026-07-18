/** Matches the `h-7` pill height used across Zoom/Trim/Speed/Crop/Caption tracks. */
export const LANE_HEIGHT_PX = 28;
export const LANE_GAP_PX = 4;

/**
 * CutTimeline's clip row height -- lives here (not on CutTimeline itself) so
 * a pill track can match it (e.g. ZoomTrack passing this as `laneHeightPx`)
 * without importing CutTimeline.tsx, which imports that track back for
 * rendering and would otherwise create a circular import.
 */
export const CLIP_ROW_HEIGHT_PX = 38;

export interface LanePosition {
  leftPercent: number;
  widthPercent: number;
}

export interface Laned<T> {
  item: T;
  position: LanePosition;
  /** 0-indexed row within the track -- overlapping items never share a lane. */
  lane: number;
}

/**
 * Greedy interval-scheduling lane assignment (the classic "minimum meeting
 * rooms" algorithm): items are laid out in a single percent-space row, but
 * when two overlap in time they'd draw on top of each other since pills are
 * absolutely positioned -- e.g. zoom keyframes packed close together, or
 * captions that overlap. Assigns each item to the first lane whose
 * previous occupant has already ended by the time this one starts, opening
 * a new lane only when every existing one is still occupied.
 */
export function assignLanes<T>(
  items: T[],
  getPosition: (item: T) => LanePosition | null
): Laned<T>[] {
  const positioned = items
    .map((item) => ({ item, position: getPosition(item) }))
    .filter((p): p is { item: T; position: LanePosition } => p.position !== null)
    .sort((a, b) => a.position.leftPercent - b.position.leftPercent);

  const laneEndPercent: number[] = [];
  return positioned.map(({ item, position }) => {
    const rightEdge = position.leftPercent + position.widthPercent;
    // Small epsilon so pills that end exactly where the next one starts
    // don't get pushed into a new lane over floating-point noise.
    let lane = laneEndPercent.findIndex((end) => end <= position.leftPercent + 0.01);
    if (lane === -1) {
      lane = laneEndPercent.length;
      laneEndPercent.push(rightEdge);
    } else {
      laneEndPercent[lane] = rightEdge;
    }
    return { item, position, lane };
  });
}

export function laneCount(laned: Pick<Laned<unknown>, 'lane'>[]): number {
  return laned.reduce((max, l) => Math.max(max, l.lane + 1), 0);
}
