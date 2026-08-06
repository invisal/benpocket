import { useEffect, useRef, type RefObject } from 'react';
import type { PreviewVideoController } from '@screen-recorder/types/editor';

interface UseApplySeekRequestOptions {
  videoRef: RefObject<PreviewVideoController | null>;
  seekRequestMs: number | null;
  clearSeekRequest: () => void;
}

/**
 * Applies `seekRequestMs` to the active <video> element -- but coalesces
 * rapid-fire requests rather than firing every single one as it arrives.
 * Hover-scrubbing the timeline ruler dispatches one of these per
 * `pointermove` (see CutTimeline.tsx's `handleRulerPointerMove`), which for
 * a large recording streamed off disk (main/screen-recorder/security/
 * media-protocol.ts) is a real Range request + disk read each time, not an
 * instant in-memory index the way a fully-buffered Blob was -- applying
 * every request as it arrives just queues up a growing backlog of
 * already-stale seeks the video has to work through in order, which is what
 * makes the preview visibly lag behind the mouse. Instead: at most one seek
 * in flight at a time, always resolving to whatever the *latest* requested
 * position was once the in-flight one's `seeking` flag clears (checked via
 * a rAF poll -- `HTMLVideoElement` has no "seek settled" event of its own
 * that fires reliably across an aborted-and-superseded seek).
 */
export function useApplySeekRequest({
  videoRef,
  seekRequestMs,
  clearSeekRequest
}: UseApplySeekRequestOptions): void {
  const pendingMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (seekRequestMs === null) return;
    pendingMsRef.current = seekRequestMs;
    clearSeekRequest();
  }, [seekRequestMs, clearSeekRequest]);

  useEffect(() => {
    let rafId: number;
    const tick = (): void => {
      const pendingMs = pendingMsRef.current;
      const video = videoRef.current;
      if (video && pendingMs !== null && !video.seeking) {
        pendingMsRef.current = null;
        video.currentTime = pendingMs / 1000;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef]);
}
