import type { JSX } from 'react';
import { TimelineTrack } from './TimelineTrack';
import { useTimelineStore } from '../store/timeline-store';

// TODO: playhead, zoom-to-fit controls, snapping guides overlay (see
// SnapGuides.tsx), and drag-to-trim handles on each segment.
export function Timeline(): JSX.Element {
  const { tracks } = useTimelineStore();

  return (
    <div className="flex h-48 flex-col gap-1 border-t border-white/10 bg-surface-raised p-2">
      {tracks.map((track) => (
        <TimelineTrack key={track.id} track={track} />
      ))}
    </div>
  );
}
