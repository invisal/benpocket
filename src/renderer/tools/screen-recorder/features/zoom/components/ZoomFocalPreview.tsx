import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { useIndependentObjectUrl } from '../../../lib/use-independent-object-url';

interface ZoomFocalPreviewProps {
  /** This keyframe's own timestamp (source ms) -- the mini preview shows this exact frame, not just the recording's first frame, since positioning against a frame from a different moment would be misleading if the screen content moved since then. */
  atMs: number;
  /** Needed to scrub the main preview to the middle of this keyframe's hold window while dragging (see `startDragging`), so it shows the actual zoomed framing live instead of the pre-ramp unzoomed frame. */
  durationMs: number;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  /** Recording's native aspect ratio, when known -- keeps the box's proportions matching the real video so the dot's normalized position maps back onto it without letterboxing skewing the math. Falls back to 16:9 before metadata loads. */
  aspectRatio?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Small self-contained preview box (not the live editor stage) showing the
 * keyframe's own frame with a draggable dot for its zoom focal point --
 * lets the user fine-tune the target by dragging the dot directly over a
 * thumbnail of the shot, instead of arming positioning mode and clicking
 * elsewhere on the main preview. Only the dot itself starts a drag --
 * clicking elsewhere in the frame is a no-op, so an accidental tap can't
 * jump the target.
 */
export function ZoomFocalPreview({
  atMs,
  durationMs,
  position,
  onPositionChange,
  aspectRatio
}: ZoomFocalPreviewProps): JSX.Element {
  const recordingPreviewUrl = useScreenRecorderStore((s) => s.lastRecording?.previewUrl);

  const previewUrl = useIndependentObjectUrl(recordingPreviewUrl);
  const previewSeek = useTimelineStore((s) => s.previewSeek);
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const preDragPlayheadMsRef = useRef<number | null>(null);

  // Kept in a ref, not a `useCallback` dependency -- `onPositionChange` is a
  // fresh closure every render (its caller re-derives `kf` from the zoom
  // store on every position update), so depending on it directly made
  // `commitFromEvent`/`handlePointerMove`/`stopDragging` below all change
  // identity mid-drag, which retriggered the unmount-safety effect further
  // down and tore the drag's window listeners down after just one move.
  // Routing through a ref keeps those callbacks stable across the whole
  // drag while still always calling the latest `onPositionChange`.
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const seekTo = (): void => {
      video.currentTime = atMs / 1000;
    };
    if (video.readyState >= 1) seekTo();
    else video.addEventListener('loadedmetadata', seekTo, { once: true });
    return () => video.removeEventListener('loadedmetadata', seekTo);
  }, [atMs, previewUrl]);

  const commitFromEvent = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    onPositionChangeRef.current({
      x: clamp01((clientX - bounds.left) / bounds.width),
      y: clamp01((clientY - bounds.top) / bounds.height)
    });
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      commitFromEvent(event.clientX, event.clientY);
    },
    [commitFromEvent]
  );

  const stopDragging = useCallback(() => {
    if (isDraggingRef.current) endGesture();
    isDraggingRef.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    // Restore whatever the main playhead was showing before this drag
    // started -- `previewSeek` below only temporarily previews the hold
    // frame, the same "preview then revert" convention CutTimeline.tsx's
    // ruler hover-scrub uses, so opening/dragging this panel never leaves
    // the timeline's actual position somewhere the user didn't ask for.
    if (preDragPlayheadMsRef.current !== null) {
      requestSeek(preDragPlayheadMsRef.current);
      preDragPlayheadMsRef.current = null;
    }
  }, [handlePointerMove, requestSeek]);

  // Guards against the pointerup listener never firing (e.g. this panel
  // unmounts mid-drag because the selected keyframe changed) -- otherwise
  // the gesture it opened would stay open forever, silently swallowing every
  // undo-tracked change made afterward.
  useEffect(() => stopDragging, [stopDragging]);

  function startDragging(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    beginGesture();
    isDraggingRef.current = true;
    preDragPlayheadMsRef.current = useTimelineStore.getState().playheadMs;
    // Scrub the main preview to the middle of this keyframe's hold window,
    // not its very start -- at `atMs` itself the zoom-in ramp hasn't reached
    // full depth yet (see zoom-resolve.ts's `resolveZoom`), so the main
    // stage would still show the unzoomed frame and dragging the dot would
    // look like it's doing nothing there.
    previewSeek(atMs + durationMs / 2);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging, { once: true });
  }

  return (
    <div className="rounded-xl border border-line bg-black p-2">
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
      >
        {previewUrl && (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none h-full w-full object-contain"
          />
        )}
        <div
          onPointerDown={startDragging}
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-purple-200 bg-fuchsia-600 active:cursor-grabbing"
          style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
        />
      </div>
    </div>
  );
}
