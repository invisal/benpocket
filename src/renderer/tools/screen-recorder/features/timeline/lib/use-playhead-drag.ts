import { useCallback, useEffect, useRef, type RefObject } from 'react';

interface UsePlayheadDragOptions {
  seekFromClientX: (clientX: number) => void;
}

/**
 * Drag-to-scrub for the real (blue) playhead handle. rAF-throttled, not one
 * `requestSeek` per raw `pointermove` -- a fast drag can fire that event far
 * more often than once per frame, and `requestSeek` (unlike hover-scrub's
 * `previewSeek`) also writes `playheadMs`, which re-renders every
 * track/tick/pill subscribed to it (see Playhead.tsx's own doc on why it's
 * split out for exactly this reason). Collapsing to the latest clientX per
 * frame cuts that fan-out down to the screen's actual refresh rate instead
 * of the pointer's.
 *
 * Doesn't take an "on start" callback for e.g. cancelling an in-progress
 * hover-scrub baseline -- callers that need that should wrap the returned
 * `startPlayheadDrag` themselves (see CutTimeline.tsx), since hover-scrub's
 * own `cancelHover` isn't available yet at the point this hook is called
 * (it in turn needs this hook's `playheadDraggingRef` for its own gating).
 */
export function usePlayheadDrag({ seekFromClientX }: UsePlayheadDragOptions): {
  startPlayheadDrag: (event: React.PointerEvent) => void;
  /** Synchronous -- for reads inside other event handlers (e.g. hover-scrub's own gating), where a ref (not state) is needed to avoid a stale closure. */
  playheadDraggingRef: RefObject<boolean>;
} {
  const playheadDraggingRef = useRef(false);
  const dragRafIdRef = useRef<number | null>(null);
  const pendingDragClientXRef = useRef<number | null>(null);

  const handleMove = useCallback(
    (event: PointerEvent) => {
      if (!playheadDraggingRef.current) return;
      pendingDragClientXRef.current = event.clientX;
      if (dragRafIdRef.current !== null) return;
      dragRafIdRef.current = requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        const clientX = pendingDragClientXRef.current;
        if (clientX !== null) seekFromClientX(clientX);
      });
    },
    [seekFromClientX]
  );

  const stopPlayheadDrag = useCallback(() => {
    playheadDraggingRef.current = false;
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    pendingDragClientXRef.current = null;
    window.removeEventListener('pointermove', handleMove);
  }, [handleMove]);

  const startPlayheadDrag = useCallback(
    (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      playheadDraggingRef.current = true;
      seekFromClientX(event.clientX);
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', stopPlayheadDrag, { once: true });
    },
    [seekFromClientX, handleMove, stopPlayheadDrag]
  );

  useEffect(() => {
    return () => {
      stopPlayheadDrag();
      window.removeEventListener('pointerup', stopPlayheadDrag);
    };
  }, [stopPlayheadDrag]);

  return { startPlayheadDrag, playheadDraggingRef };
}
