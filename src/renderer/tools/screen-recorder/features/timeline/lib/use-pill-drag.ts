import { useCallback, useRef, type RefObject } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { outputMsToSourceMs, sourceMsToOutputMs } from './segment-duration';

type Seg = Pick<TimelineSegment, 'range' | 'speed'>;

interface UsePillDragOptions {
  /** The shared zoom-scaled track row pills are positioned within -- see CutTimeline.tsx. */
  containerRef: RefObject<HTMLElement | null>;
  segments: Seg[];
  totalOutputMs: number;
}

/**
 * Drag-to-reposition for a pill anchored to a single source-ms point (a zoom
 * keyframe's `atMs`, a caption's `startMs`) -- used by any per-tool track
 * (Zoom/Caption/...) so every pill is freely draggable along the timeline,
 * not just click-to-seek.
 *
 * Works in the ripple/output-ms space (via `sourceMsToOutputMs`/
 * `outputMsToSourceMs`) so a pixel of drag always means the same visual
 * distance as the ruler above it, and dragging naturally clamps to wherever
 * kept segments actually are -- it can't drop a pill into a cut-out gap.
 */
export function usePillDrag({ containerRef, segments, totalOutputMs }: UsePillDragOptions) {
  const dragRef = useRef<{
    startClientX: number;
    startOutputMs: number;
    widthPx: number;
    onMove: (newSourceMs: number) => void;
  } | null>(null);
  // `true` for the drag that just ended, so a pill's onClick (which fires
  // right after pointerup) can skip its normal click behavior instead of
  // treating the drag's release as a click too.
  const didDragRef = useRef(false);

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || totalOutputMs <= 0) return;
      const deltaPx = event.clientX - drag.startClientX;
      if (Math.abs(deltaPx) > 3) didDragRef.current = true;
      const deltaOutputMs = (deltaPx / drag.widthPx) * totalOutputMs;
      const newOutputMs = Math.min(totalOutputMs, Math.max(0, drag.startOutputMs + deltaOutputMs));
      const newSourceMs = outputMsToSourceMs(segments, newOutputMs);
      if (newSourceMs !== null) drag.onMove(newSourceMs);
    },
    [segments, totalOutputMs]
  );

  const stop = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', handleMove);
  }, [handleMove]);

  const startDrag = useCallback(
    (startSourceMs: number, onMove: (newSourceMs: number) => void) =>
      (event: React.PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        const container = containerRef.current;
        if (!container) return;
        didDragRef.current = false;
        dragRef.current = {
          startClientX: event.clientX,
          startOutputMs: sourceMsToOutputMs(segments, startSourceMs) ?? 0,
          widthPx: container.getBoundingClientRect().width,
          onMove
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stop, { once: true });
      },
    [containerRef, segments, handleMove, stop]
  );

  return { startDrag, didDragRef };
}
