import type { JSX, ReactNode } from 'react';
import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
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
  /** Whether an item is toggled off -- dims the pill and, via `onToggleDisabled`'s own handler, skips whatever the item actually does (e.g. `resolveZoom` ignoring a disabled zoom keyframe) without deleting it. */
  isDisabled?: (item: T) => boolean;
  onToggleDisabled?: (item: T) => void;
  onDuplicate?: (item: T) => void;
  renderExtraMenuItems?: (item: T) => ReactNode;
}

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
  onDelete,
  isDisabled,
  onToggleDisabled,
  onDuplicate,
  renderExtraMenuItems
}: PillTrackProps<T>): JSX.Element | null {
  const totalOutputMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startDrag, didDragRef, isDragging } = usePillDrag({
    containerRef,
    segments,
    totalOutputMs
  });
  const { startResize, isResizing } = useEdgeResize();
  // While the user is actively moving or resizing a pill, its `layout`
  // transition below is suppressed (duration 0) so it tracks the cursor
  // directly instead of animating a moving target -- only reposition from
  // something *other* than the user's own drag (a sibling added/removed, an
  // undo, another pill's resize shifting lanes) should actually glide.
  const layoutTransition =
    isDragging || isResizing ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' as const };

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
        <AnimatePresence initial={false}>
          {laned.map(({ item, position, lane }) => {
            const startMs = getStartMs(item);
            const durationMs = getDurationMs(item);
            const endMs = startMs + durationMs;
            return (
              <ContextMenu.Root key={item.id}>
                <ContextMenu.Trigger
                  render={
                    <motion.div
                      layout="position"
                      transition={layoutTransition}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      whileHover={{ scale: 1.03 }}
                      onPointerDown={startDrag(startMs, (newStartMs) => onMove(item, newStartMs))}
                      onClick={() => {
                        if (!didDragRef.current) onSelect(item);
                      }}
                      title={getTitle(item)}
                      className={cn(
                        'group absolute flex cursor-grab items-center justify-center gap-1 overflow-hidden rounded-xl border px-2 active:cursor-grabbing',
                        colorClassName,
                        isSelected?.(item) && 'ring-2 ring-purple-200',
                        isDisabled?.(item) && 'opacity-40'
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
                    </motion.div>
                  }
                />
                {(onToggleDisabled || onDuplicate || renderExtraMenuItems || onDelete) && (
                  <ContextMenu.Content>
                    {onToggleDisabled && (
                      <ContextMenu.Item onClick={() => onToggleDisabled(item)}>
                        <span className="flex items-center gap-2">
                          {isDisabled?.(item) ? (
                            <Eye size={14} className="text-text-dim" />
                          ) : (
                            <EyeOff size={14} className="text-text-dim" />
                          )}
                          {isDisabled?.(item) ? 'Enable' : 'Disable'}
                        </span>
                      </ContextMenu.Item>
                    )}
                    {onDuplicate && (
                      <ContextMenu.Item onClick={() => onDuplicate(item)}>
                        <span className="flex items-center gap-2">
                          <Copy size={14} className="text-text-dim" />
                          Duplicate
                        </span>
                      </ContextMenu.Item>
                    )}
                    {renderExtraMenuItems?.(item)}
                    {onDelete && (
                      <>
                        <ContextMenu.Separator />
                        <ContextMenu.Item
                          onClick={() => onDelete(item)}
                          className="text-danger data-[highlighted]:text-danger"
                        >
                          <span className="flex items-center gap-2">
                            <Trash2 size={14} className="text-danger" />
                            Delete
                          </span>
                        </ContextMenu.Item>
                      </>
                    )}
                  </ContextMenu.Content>
                )}
              </ContextMenu.Root>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
