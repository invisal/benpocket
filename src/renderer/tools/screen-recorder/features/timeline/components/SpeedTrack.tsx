import type { JSX } from 'react';
import { Gauge } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../store/timeline-store';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { cn } from '../../../lib/utils';

/**
 * Pill track mirroring the kept clips above it (same output-order widths as
 * CutTimeline's own row, so pills line up in the same columns), but only
 * drawing a pill for clips whose speed isn't 1x -- click one to select that
 * clip (drives the Clip tool panel's Speed section), or drag it (pill or
 * spacer alike) to reorder the underlying clip, same as CutTimeline's row.
 */
export function SpeedTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;
  const hasAny = segments.some((s) => s.speed !== 1);

  return (
    <div className="flex h-9 shrink-0 items-center">
      {hasAny && (
        <div className="flex h-7 flex-1 items-center gap-0.5">
          {segments.map((segment, index) => {
            const widthPercent = (getSegmentOutputDurationMs(segment) / clampedTotal) * 100;
            if (segment.speed === 1) {
              return (
                <div
                  key={segment.id}
                  {...getDragHandlers(index)}
                  className={cn(
                    'h-full cursor-grab',
                    dragOverIndex === index && 'ring-2 ring-accent'
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
              );
            }
            return (
              <button
                key={segment.id}
                {...getDragHandlers(index)}
                onClick={() => setSelectedSegmentId(segment.id)}
                title={`${segment.speed}x -- drag to reorder`}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  'flex h-7 min-w-9 cursor-grab items-center justify-center gap-1 rounded-full border border-amber-500/50 bg-amber-700/30 px-1.5 text-amber-100 hover:bg-amber-700/45 active:cursor-grabbing',
                  selectedSegmentId === segment.id && 'ring-2 ring-white/70',
                  dragOverIndex === index && 'ring-2 ring-accent'
                )}
              >
                <Gauge size={10} className="shrink-0" />
                <span className="truncate text-[10px] font-medium">{segment.speed}×</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
