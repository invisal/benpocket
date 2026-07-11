import type { JSX } from 'react';
import { Crop } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useSegmentReorderDrag } from '../../timeline/lib/use-segment-reorder-drag';
import { cn } from '../../../lib/utils';

/**
 * Pill track mirroring the kept clips above it (same output-order widths as
 * CutTimeline's own row), drawing a pill only for clips with a crop applied.
 * Click one to select that clip -- drives CropOverlay and the crop rect it
 * reads/writes (`TimelineSegment.crop`) -- or drag it (pill or spacer alike)
 * to reorder the underlying clip, same as CutTimeline's row.
 */
export function CropTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;
  const hasAny = segments.some((s) => s.crop !== null);

  return (
    <div className="flex h-9 shrink-0 items-center">
      {hasAny && (
        <div className="flex h-7 flex-1 items-center gap-0.5">
          {segments.map((segment, index) => {
            const widthPercent = (getSegmentOutputDurationMs(segment) / clampedTotal) * 100;
            if (!segment.crop) {
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
                title={`${Math.round(segment.crop.width * 100)}% × ${Math.round(segment.crop.height * 100)}% -- drag to reorder`}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  'flex h-7 min-w-9 cursor-grab items-center justify-center gap-1 rounded-full border border-sky-500/50 bg-sky-700/30 px-1.5 text-sky-100 hover:bg-sky-700/45 active:cursor-grabbing',
                  selectedSegmentId === segment.id && 'ring-2 ring-white/70',
                  dragOverIndex === index && 'ring-2 ring-accent'
                )}
              >
                <Crop size={10} className="shrink-0" />
                <span className="truncate text-[10px] font-medium">
                  {Math.round(segment.crop.width * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
