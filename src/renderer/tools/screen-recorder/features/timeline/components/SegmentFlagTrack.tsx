import type { JSX, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../store/timeline-store';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { cn } from '../../../lib/utils';

export interface SegmentFlagTrackProps {
  hasFlag: (segment: TimelineSegment) => boolean;
  getTitle: (segment: TimelineSegment) => string;
  /** Pill border/background/text color classes, e.g. `'border-amber-500/50 bg-amber-700/30 text-amber-100 hover:bg-amber-700/45'`. */
  colorClassName: string;
  renderContent: (segment: TimelineSegment) => ReactNode;
  onReset: (segment: TimelineSegment) => void;
  resetTitle: string;
}

/**
 * Shared shape behind Trim/Speed/Crop tracks: unlike PillTrack's
 * independently-timed items, these pills mirror a clip that already exists
 * in CutTimeline's own row 1:1 -- same output-order width/position, no
 * independent start/duration of their own -- so there's nothing here to
 * drag-move or edge-resize. Only clips matching `hasFlag` get a pill; the
 * rest render as a same-width invisible spacer so every clip stays a drag
 * target for reordering (`useSegmentReorderDrag`, the same action
 * CutTimeline's own row uses).
 */
export function SegmentFlagTrack({
  hasFlag,
  getTitle,
  colorClassName,
  renderContent,
  onReset,
  resetTitle
}: SegmentFlagTrackProps): JSX.Element | null {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;
  const hasAny = segments.some(hasFlag);
  // See PillTrack.tsx for why this is `null`, not an empty placeholder div.
  if (!hasAny) return null;

  return (
    <div className="flex h-9 shrink-0 items-center">
      <div className="flex h-7 flex-1 items-center gap-0.5">
        {segments.map((segment, index) => {
          const widthPercent = (getSegmentOutputDurationMs(segment) / clampedTotal) * 100;
          if (!hasFlag(segment)) {
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
            <div
              key={segment.id}
              {...getDragHandlers(index)}
              onClick={() => setSelectedSegmentId(segment.id)}
              title={getTitle(segment)}
              style={{ width: `${widthPercent}%` }}
              className={cn(
                'group flex h-7 min-w-9 cursor-grab items-center justify-center gap-1 rounded-md border px-1.5 active:cursor-grabbing',
                colorClassName,
                selectedSegmentId === segment.id && 'ring-2 ring-white/70',
                dragOverIndex === index && 'ring-2 ring-accent'
              )}
            >
              {renderContent(segment)}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReset(segment);
                }}
                title={resetTitle}
                draggable={false}
                className="ml-auto hidden h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/70 text-white/70 hover:text-red-400 group-hover:flex"
              >
                <Trash2 size={9} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
