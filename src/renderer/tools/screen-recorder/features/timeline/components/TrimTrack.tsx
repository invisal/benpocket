import type { JSX } from 'react';
import { Scissors } from 'lucide-react';
import { useTimelineStore } from '../store/timeline-store';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { SegmentFlagTrack } from './SegmentFlagTrack';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Sparse "this clip was trimmed" indicator -- see SegmentFlagTrack.tsx. */
export function TrimTrack(): JSX.Element | null {
  const setSegmentTrimmed = useTimelineStore((s) => s.setSegmentTrimmed);

  return (
    <SegmentFlagTrack
      hasFlag={(segment) => segment.trimmed}
      getTitle={(segment) =>
        `${formatTime(getSegmentOutputDurationMs(segment))} -- drag to reorder`
      }
      colorClassName="border-red-400/40 bg-red-500/20 text-red-200/90 hover:bg-red-500/30"
      renderContent={() => (
        <>
          <Scissors size={10} className="shrink-0" />
          <span className="truncate text-[10px] font-medium">Trim</span>
        </>
      )}
      onReset={(segment) => setSegmentTrimmed(segment.id, false)}
      resetTitle="Dismiss"
    />
  );
}
