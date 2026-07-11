import { useRef, useState } from 'react';
import { useTimelineStore } from '../store/timeline-store';

/**
 * Native HTML5 drag-and-drop reordering for per-segment pill tracks
 * (Speed/Crop) -- each pill mirrors an actual `TimelineSegment` 1:1, so
 * "dragging" one means reordering the underlying clip, the same
 * `reorderSegments` action CutTimeline's own row uses. Every segment's slot
 * (pill or empty spacer) needs to be a drag target so dropping anywhere in
 * the row's column reorders correctly, matching CutTimeline's row exactly.
 */
export function useSegmentReorderDrag(): {
  dragOverIndex: number | null;
  getDragHandlers: (index: number) => {
    draggable: true;
    onDragStart: (event: React.DragEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: React.DragEvent) => void;
  };
} {
  const reorderSegments = useTimelineStore((s) => s.reorderSegments);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  function getDragHandlers(index: number) {
    return {
      draggable: true as const,
      onDragStart: (event: React.DragEvent) => {
        dragIndexRef.current = index;
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOverIndex(index);
      },
      onDragLeave: () => setDragOverIndex((current) => (current === index ? null : current)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const from = dragIndexRef.current;
        setDragOverIndex(null);
        dragIndexRef.current = null;
        if (from === null) return;
        reorderSegments(from, index);
      }
    };
  }

  return { dragOverIndex, getDragHandlers };
}
