import type { JSX } from 'react';
import { TIMELINE_SNAP_THRESHOLD_PX } from '@shared/constants';

// TODO: while dragging a segment edge, compute candidate snap targets
// (other segment boundaries, the playhead) within TIMELINE_SNAP_THRESHOLD_PX
// and pass their x-positions in as `activeGuideXs`.
export function SnapGuides({ activeGuideXs }: { activeGuideXs: number[] }): JSX.Element {
  return (
    <>
      {activeGuideXs.map((x) => (
        <div key={x} className="absolute bottom-0 top-0 w-px bg-accent/70" style={{ left: x }} />
      ))}
    </>
  );
}

// Referenced here so the snap threshold constant has a clear owner; consumed
// by the (TODO) drag-handling logic in TimelineTrack.
export const SNAP_THRESHOLD_PX = TIMELINE_SNAP_THRESHOLD_PX;
