import type { JSX } from 'react';
import { Gauge } from 'lucide-react';
import { useTimelineStore } from '../store/timeline-store';
import { SegmentFlagTrack } from './SegmentFlagTrack';

/** Pill track for clips whose speed isn't 1x -- see SegmentFlagTrack.tsx. */
export function SpeedTrack(): JSX.Element | null {
  const setSegmentSpeed = useTimelineStore((s) => s.setSegmentSpeed);

  return (
    <SegmentFlagTrack
      hasFlag={(segment) => segment.speed !== 1}
      getTitle={(segment) => `${segment.speed}x -- drag to reorder`}
      colorClassName="border-amber-500/50 bg-amber-700/30 text-amber-100 hover:bg-amber-700/45"
      renderContent={(segment) => (
        <>
          <Gauge size={10} className="shrink-0" />
          <span className="truncate text-[10px] font-medium">{segment.speed}×</span>
        </>
      )}
      onReset={(segment) => setSegmentSpeed(segment.id, 1)}
      resetTitle="Reset to 1x"
    />
  );
}
