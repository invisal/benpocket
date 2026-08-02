import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { beginGesture, endGesture } from '../../history/store/history-store';

/**
 * Drag-to-resize for a pill's left/right edge, the same "grab an edge, drag
 * to trim" interaction the main clip row has always had -- pulled out into a
 * hook so every track can offer it, not just video segments. Callers supply
 * a per-drag `onResize(newValueMs)` (the pill's own current start/end and
 * duration, plus its rendered width in px, so a pixel of drag always maps to
 * the same ms delta the pill is actually showing) and decide what "start"
 * or "end" means for their own data (a clip's `range.startMs`, a zoom
 * keyframe's `atMs`/`durationMs` pair, a caption's `startMs`/`endMs`) --
 * this hook only does the pixel-to-ms math and pointer bookkeeping.
 */
export function useEdgeResize(): {
  startResize: (
    startValueMs: number,
    durationMs: number,
    blockWidthPx: number,
    onResize: (newValueMs: number) => void
  ) => (event: React.PointerEvent) => void;
  /** Reactive -- for gating a `motion` layout transition so a pill doesn't lag its own edge-resize drag. */
  isResizing: boolean;
  /** Same flag as `isResizing`, but synchronous -- for reads inside event handlers, where a ref (not state) is needed to avoid a stale closure. */
  isResizingRef: RefObject<boolean>;
} {
  const dragRef = useRef<{
    startClientX: number;
    startValueMs: number;
    pxPerMs: number;
    onResize: (newValueMs: number) => void;
  } | null>(null);
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaMs = (event.clientX - drag.startClientX) / drag.pxPerMs;
    drag.onResize(drag.startValueMs + deltaMs);
  }, []);

  const stop = useCallback(() => {
    if (dragRef.current) endGesture();
    dragRef.current = null;
    isResizingRef.current = false;
    setIsResizing(false);
    window.removeEventListener('pointermove', handleMove);
  }, [handleMove]);

  // Guards against the pointerup listener never firing (component unmounts
  // mid-drag) -- otherwise the gesture it opened would stay open forever,
  // silently swallowing every undo-tracked change made afterward.
  useEffect(() => stop, [stop]);

  const startResize = useCallback(
    (
      startValueMs: number,
      durationMs: number,
      blockWidthPx: number,
      onResize: (newValueMs: number) => void
    ) =>
      (event: React.PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        beginGesture();
        isResizingRef.current = true;
        setIsResizing(true);
        dragRef.current = {
          startClientX: event.clientX,
          startValueMs,
          pxPerMs: blockWidthPx / Math.max(durationMs, 1),
          onResize
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stop, { once: true });
      },
    [handleMove, stop]
  );

  return { startResize, isResizing, isResizingRef };
}
