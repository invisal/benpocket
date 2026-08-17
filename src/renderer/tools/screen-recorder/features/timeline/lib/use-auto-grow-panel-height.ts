import { useEffect, type RefObject } from 'react';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';

interface UseAutoGrowPanelHeightOptions {
  trackAreaRef: RefObject<HTMLDivElement | null>;
  toolbarRowRef: RefObject<HTMLDivElement | null>;
  minPx: number;
  maxPx: number;
  /** Chrome (padding/gaps) around `trackArea`/`toolbarRow` that isn't covered by measuring those two directly -- see CutTimeline.tsx's own constant for the exact breakdown. */
  chromePx: number;
}

/**
 * Auto-grows the panel to fit its content as tracks (Zoom/Caption/
 * Annotation/Blur-Mask) gain pills or their pills stack into more lanes --
 * `trackAreaRef` isn't itself height-constrained (only its scroll container
 * around it is, via `overflow-auto`), so its `offsetHeight` always reflects
 * the *true* content height regardless of how much of it currently fits.
 * Grow-only and driven by `getState()`/`setState()` rather than a subscribed
 * value, so back-to-back ResizeObserver firings (e.g. several pills mounting
 * in the same frame) each compare against the latest committed height
 * instead of a stale render's closure -- and so a track shrinking (a pill
 * deleted) never yanks the panel back down under whatever the user's still
 * looking at; only manually dragging the handle does that.
 */
export function useAutoGrowPanelHeight({
  trackAreaRef,
  toolbarRowRef,
  minPx,
  maxPx,
  chromePx
}: UseAutoGrowPanelHeightOptions): void {
  useEffect(() => {
    const trackArea = trackAreaRef.current;
    const toolbarRow = toolbarRowRef.current;
    if (!trackArea || !toolbarRow) return;

    function recalcAutoHeight(): void {
      const requiredPx = toolbarRow!.offsetHeight + trackArea!.offsetHeight + chromePx;
      const clampedPx = Math.min(maxPx, Math.max(minPx, requiredPx));
      const currentPx = useScreenRecorderStore.getState().timelinePanelHeight;
      if (clampedPx > currentPx) {
        useScreenRecorderStore.getState().setTimelinePanelHeight(clampedPx);
      }
    }

    const observer = new ResizeObserver(recalcAutoHeight);
    observer.observe(trackArea);
    recalcAutoHeight();
    return () => observer.disconnect();
  }, [trackAreaRef, toolbarRowRef, minPx, maxPx, chromePx]);
}
