import type { JSX, ReactNode } from 'react';
import { useRef } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { getSegmentOutputDurationMs, sourceRangeToOutputPercent } from '../lib/segment-duration';
import { assignLanes, laneCount, LANE_HEIGHT_PX, LANE_GAP_PX } from '../lib/assign-lanes';
import { usePillDrag } from '../lib/use-pill-drag';
import { useEdgeResize } from '../lib/use-edge-resize';
import { cn } from '../../../lib/utils';

export interface PillTrackProps<T extends { id: string }> {
  items: T[];
  /** The primary track's kept clips, for source-ms <-> output-ms mapping (see segment-duration.ts). */
  segments: TimelineSegment[];
  getStartMs: (item: T) => number;
  getDurationMs: (item: T) => number;
  isSelected?: (item: T) => boolean;
  getTitle: (item: T) => string;
  /** Pill border/background/text color classes, e.g. `'border-emerald-400/50 bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/45'`. */
  colorClassName: string;
  /** Edge-resize grip color classes -- defaults to a light overlay that reads against the usual dark/translucent pill fills. Override for a pill whose `colorClassName` is light (e.g. a gradient fill) where a white overlay would wash out. */
  handleClassName?: string;
  /** Pill height in px -- defaults to `LANE_HEIGHT_PX` (the compact single-line height every other pill track uses). Override for content that needs more room (e.g. a title row above the icon row), scoped to just that track's own lane stack. */
  laneHeightPx?: number;
  renderContent: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onMove: (item: T, newStartMs: number) => void;
  onResizeStart: (item: T, newStartMs: number) => void;
  onResizeEnd: (item: T, newEndMs: number) => void;
  onDelete?: (item: T) => void;
}

/**
 * Shared shape behind ZoomTrack/CaptionTrack: pills for independently timed
 * items (own start + duration, not tied to a clip's position), drawn as
 * absolutely-positioned chips over the ripple/output timeline.
 *
 * Item `startMs`/`durationMs` are authored against the *source* recording's
 * raw timeline (same convention every per-tool track uses), but pills are
 * drawn on the ripple/*output* timeline CutTimeline draws -- mapped via
 * `sourceRangeToOutputPercent`, so this stays correctly positioned even
 * after the recording's been split/trimmed. An item entirely inside a
 * cut-out gap is simply not drawn.
 *
 * Items packed close together in time would otherwise draw on top of each
 * other (they're all absolutely positioned in the same row) -- laid out via
 * `assignLanes` instead, so overlapping ones stack into extra rows and the
 * track grows tall enough to fit them all legibly.
 *
 * Click a pill to select it, drag its body to move it (`usePillDrag`), or
 * drag either edge to trim it (`useEdgeResize`) -- the same "grab an edge"
 * interaction the main clip row has always had. Right-click for a context
 * menu with Delete (`onDelete`), instead of a permanently-competing hover
 * button.
 */
export function PillTrack<T extends { id: string }>({
  items,
  segments,
  getStartMs,
  getDurationMs,
  isSelected,
  getTitle,
  colorClassName,
  handleClassName = 'bg-white/15 hover:bg-white/30',
  laneHeightPx = LANE_HEIGHT_PX,
  renderContent,
  onSelect,
  onMove,
  onResizeStart,
  onResizeEnd,
  onDelete
}: PillTrackProps<T>): JSX.Element | null {
  const totalOutputMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startDrag, didDragRef } = usePillDrag({ containerRef, segments, totalOutputMs });
  const { startResize } = useEdgeResize();

  const laned = assignLanes(items, (item) =>
    sourceRangeToOutputPercent(
      segments,
      totalOutputMs,
      getStartMs(item),
      getStartMs(item) + getDurationMs(item)
    )
  );
  const trackHeightPx =
    Math.max(1, laneCount(laned)) * laneHeightPx + Math.max(0, laneCount(laned) - 1) * LANE_GAP_PX;
  // Not even an empty placeholder div -- the parent track stack is a
  // `flex-col gap-1.5`, and that gap still reserves space around a rendered
  // child even if the child itself is 0-height, so an empty track would
  // otherwise leave a visible blank strip.
  if (laned.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center py-1 px-1">
      <div ref={containerRef} className="relative flex-1" style={{ height: trackHeightPx }}>
        {laned.map(({ item, position, lane }) => {
          const startMs = getStartMs(item);
          const durationMs = getDurationMs(item);
          const endMs = startMs + durationMs;
          return (
            <ContextMenu.Root key={item.id}>
              <ContextMenu.Trigger
                render={
                  <div
                    onPointerDown={startDrag(startMs, (newStartMs) => onMove(item, newStartMs))}
                    onClick={() => {
                      if (!didDragRef.current) onSelect(item);
                    }}
                    title={getTitle(item)}
                    className={cn(
                      'group absolute flex cursor-grab items-center justify-center gap-1 overflow-hidden rounded-md border px-2 active:cursor-grabbing',
                      colorClassName,
                      isSelected?.(item) && 'ring-2 ring-purple-200'
                    )}
                    style={{
                      left: `${position.leftPercent}%`,
                      width: `${position.widthPercent}%`,
                      top: lane * (laneHeightPx + LANE_GAP_PX),
                      height: laneHeightPx
                    }}
                  >
                    {renderContent(item)}

                    <div
                      onPointerDown={(e) => {
                        const width =
                          e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                        startResize(startMs, durationMs, width, (newStartMs) =>
                          onResizeStart(item, newStartMs)
                        )(e);
                      }}
                      className={cn(
                        'absolute inset-y-0 left-0 w-1.5 cursor-ew-resize',
                        handleClassName
                      )}
                    />
                    <div
                      onPointerDown={(e) => {
                        const width =
                          e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                        startResize(endMs, durationMs, width, (newEndMs) =>
                          onResizeEnd(item, newEndMs)
                        )(e);
                      }}
                      className={cn(
                        'absolute inset-y-0 right-0 w-1.5 cursor-ew-resize',
                        handleClassName
                      )}
                    />
                  </div>
                }
              />
              {onDelete && (
                <ContextMenu.Content>
                  <ContextMenu.Item onClick={() => onDelete(item)}>Delete</ContextMenu.Item>
                </ContextMenu.Content>
              )}
            </ContextMenu.Root>
          );
        })}
      </div>
    </div>
  );
}
