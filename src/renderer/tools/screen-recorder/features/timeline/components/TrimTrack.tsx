import type { JSX } from 'react';
import { Scissors } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../store/timeline-store';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { cn } from '../../../lib/utils';

/**
 * Sparse "this clip was trimmed" indicator, same pattern as Speed/Crop --
 * only draws a pill for clips whose `trimmed` flag is set (edge dragged
 * away from its split/initial position; see `resizeSegmentEdge`). This is
 * NOT the editable clip list -- that's the neutral row directly under the
 * ruler in CutTimeline (drag/reorder/split/delete/resize all live there);
 * this row is a passive summary, so a click just selects the clip and a
 * drag reorders it, matching Speed/Crop rather than the main row.
 */
export function TrimTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;
  const hasAny = segments.some((s) => s.trimmed);
  if (segments.length === 0) return <div className="flex h-9 shrink-0 items-center" />;
  return (
    <div className="flex h-9 shrink-0 items-center">
      {hasAny && (
        <div className="flex h-7 flex-1 items-center gap-0.5">
          {segments.map((segment, index) => {
            const widthPercent = (getSegmentOutputDurationMs(segment) / clampedTotal) * 100;
            if (!segment.trimmed) {
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
                title={`${formatTime(getSegmentOutputDurationMs(segment))} -- drag to reorder`}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  'flex h-7 min-w-9 cursor-grab items-center justify-center gap-1 rounded-full border border-red-400/40 bg-red-500/20 px-1.5 text-red-200/90 hover:bg-red-500/30 active:cursor-grabbing',
                  selectedSegmentId === segment.id && 'ring-2 ring-white/70',
                  dragOverIndex === index && 'ring-2 ring-accent'
                )}
              >
                <Scissors size={10} className="shrink-0" />
                <span className="truncate text-[10px] font-medium">Trim</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
