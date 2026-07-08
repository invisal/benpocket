import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Clapperboard, Scissors, Trash2 } from 'lucide-react';
import type { TimelineSegment } from '@screen-studio/types/timeline';
import { useTimelineStore } from '../store/timeline-store';
import { ZoomTrack } from '../../zoom/components/ZoomTrack';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface DragResize {
  segmentId: string;
  edge: 'start' | 'end';
  startClientX: number;
  startRangeMs: { startMs: number; endMs: number };
  pxPerMs: number;
}

interface CutTimelineProps {
  /** Currently selected clip (drives the per-clip CropOverlay in EditorPage). */
  selectedSegmentId?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  /** Horizontal scale (1-4x) driven by EditorTransportBar's timeline zoom slider. */
  zoom?: number;
}

/**
 * The primary cut/trim editor: kept segments are packed edge-to-edge in
 * output order (not laid out at their original source position), so
 * removing the middle of a recording visibly closes the gap -- "ripple"
 * editing, same idea as any NLE timeline.
 *
 * Interactions:
 *  - Click a clip to select it (crop applies to whichever clip is selected).
 *  - Double-click a clip to split it there.
 *  - Drag a clip to reorder it (native HTML5 drag and drop).
 *  - Drag a clip's left/right edge to trim its in/out point.
 *  - Trash icon ripple-deletes a clip (disabled once only one is left).
 */
export function CutTimeline({
  selectedSegmentId,
  onSelectSegment,
  zoom = 1
}: CutTimelineProps): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === 'video-1')?.segments ?? []
  );
  const splitAt = useTimelineStore((s) => s.splitAt);
  const deleteSegment = useTimelineStore((s) => s.deleteSegment);
  const reorderSegments = useTimelineStore((s) => s.reorderSegments);
  const resizeSegmentEdge = useTimelineStore((s) => s.resizeSegmentEdge);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const resizeRef = useRef<DragResize | null>(null);

  const totalDurationMs = segments.reduce((sum, s) => sum + (s.range.endMs - s.range.startMs), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;

  const handleResizeMove = useCallback(
    (event: PointerEvent) => {
      const drag = resizeRef.current;
      if (!drag) return;
      const deltaMs = (event.clientX - drag.startClientX) / drag.pxPerMs;
      const newMs =
        drag.edge === 'start'
          ? drag.startRangeMs.startMs + deltaMs
          : drag.startRangeMs.endMs + deltaMs;
      resizeSegmentEdge(drag.segmentId, drag.edge, newMs);
    },
    [resizeSegmentEdge]
  );

  const stopResizing = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('pointermove', handleResizeMove);
  }, [handleResizeMove]);

  function startResize(segment: TimelineSegment, edge: 'start' | 'end', blockWidthPx: number) {
    return (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const durationMs = segment.range.endMs - segment.range.startMs;
      resizeRef.current = {
        segmentId: segment.id,
        edge,
        startClientX: event.clientX,
        startRangeMs: segment.range,
        pxPerMs: blockWidthPx / Math.max(durationMs, 1)
      };
      window.addEventListener('pointermove', handleResizeMove);
      window.addEventListener('pointerup', stopResizing, { once: true });
    };
  }

  function handleDoubleClick(
    segment: TimelineSegment,
    index: number,
    event: React.MouseEvent<HTMLDivElement>
  ) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const outputStart = segments
      .slice(0, index)
      .reduce((sum, s) => sum + (s.range.endMs - s.range.startMs), 0);
    const durationMs = segment.range.endMs - segment.range.startMs;
    splitAt(outputStart + fraction * durationMs);
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface-raised px-4 py-3">
      <div className="flex items-center gap-3 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <Scissors size={12} /> {segments.length} clip{segments.length === 1 ? '' : 's'}
        </span>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
          {formatTime(totalDurationMs)} total
        </span>
        <span className="ml-auto text-white/30">
          Click to select · double-click to split · drag to reorder or trim
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex h-16 gap-0.5" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
          {segments.map((segment, index) => {
            const widthPercent =
              ((segment.range.endMs - segment.range.startMs) / clampedTotal) * 100;
            const isSelected = selectedSegmentId === segment.id;
            return (
              <div
                key={segment.id}
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragLeave={() =>
                  setDragOverIndex((current) => (current === index ? null : current))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragIndexRef.current;
                  setDragOverIndex(null);
                  dragIndexRef.current = null;
                  if (from === null) return;
                  reorderSegments(from, index);
                }}
                onClick={() => onSelectSegment?.(segment.id)}
                onDoubleClick={(e) => handleDoubleClick(segment, index, e)}
                className={cn(
                  'group relative flex min-w-[36px] cursor-grab flex-col items-center justify-center gap-0.5 rounded-md border border-amber-400/30 bg-amber-400/15 active:cursor-grabbing',
                  dragOverIndex === index && 'ring-2 ring-accent',
                  dragOverIndex !== index && isSelected && 'ring-2 ring-white/70'
                )}
                style={{ width: `${widthPercent}%` }}
              >
                <div className="pointer-events-none flex flex-col items-center gap-0.5 text-amber-200/90">
                  <Clapperboard size={13} />
                  <span className="truncate px-1 text-[10px] font-medium">
                    {formatTime(segment.range.endMs - segment.range.startMs)}
                  </span>
                  <span className="text-[9px] text-amber-200/50">{segment.speed}x</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSegment(segment.id);
                  }}
                  disabled={segments.length <= 1}
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/70 text-white/70 hover:text-red-400 disabled:opacity-30 group-hover:flex"
                >
                  <Trash2 size={11} />
                </button>

                <div
                  onPointerDown={(e) => {
                    const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                    startResize(segment, 'start', width)(e);
                  }}
                  className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-accent/0 hover:bg-accent/70"
                />
                <div
                  onPointerDown={(e) => {
                    const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                    startResize(segment, 'end', width)(e);
                  }}
                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-accent/0 hover:bg-accent/70"
                />
              </div>
            );
          })}
        </div>
      </div>

      <ZoomTrack />
    </div>
  );
}
