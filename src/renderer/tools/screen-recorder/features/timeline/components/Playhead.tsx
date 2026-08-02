import type { JSX, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { useTimelineStore } from '../store/timeline-store';
import { sourceMsToOutputMs, sourceMsToOutputBoundaryMs } from '../lib/segment-duration';
import { TIMELINE_SCROLL_PADDING_PX } from '../lib/assign-lanes';

interface PlayheadProps {
  segments: Pick<TimelineSegment, 'range' | 'speed'>[];
  clampedTotal: number;
  onPointerDown: (event: React.PointerEvent) => void;
  /** The horizontally-scrolling track area (CutTimeline's `overflow-auto` wrapper) -- scrolled to keep the playhead in view as it moves past either edge. */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

/** Duration of the visual "glide" played when the playhead jumps discontinuously across a cut boundary during playback (see `playheadJumpToken`). */
const JUMP_GLIDE_DURATION_S = 0.15;

/**
 * Split out from CutTimeline so *only this* subscribes to `playheadMs` --
 * PreviewStage now updates it every animation frame (for smooth motion,
 * matching the zoom transform's own rAF-driven clock) rather than only on
 * the video's coarse `timeupdate` event. If CutTimeline itself read
 * `playheadMs`, that 60fps update would re-render the whole track stack
 * (every clip, every tick, every other track) on every frame; isolating it
 * here means only this small line+marker re-renders that often.
 */
export function Playhead({
  segments,
  clampedTotal,
  onPointerDown,
  scrollContainerRef
}: PlayheadProps): JSX.Element {
  const playheadMs = useTimelineStore((s) => s.playheadMs);
  const playheadJumpToken = useTimelineStore((s) => s.playheadJumpToken);
  const markerRef = useRef<HTMLDivElement>(null);

  // The circular handle below extends `HANDLE_RADIUS_PX` past the marker's
  // own `left` on every side -- padding the viewport bounds by that much
  // before comparing keeps the *handle* fully on-screen, not just the 0px-wide
  // marker line. Without this, the handle visibly got clipped by the
  // scroll container's edge as soon as it was merely half-off-screen,
  // instead of once it was actually outside the viewport.
  const HANDLE_RADIUS_PX = 7;

  // Keep the playhead in view as it moves past either edge of the (horizontally
  // zoomed, `overflow-auto`) track area -- e.g. during playback, or while
  // scrubbing near an edge. `marker.offsetLeft` is relative to its offset
  // parent (CutTimeline's `trackAreaRef`), which is the scroll container's
  // direct child -- but the scroll container itself has
  // `TIMELINE_SCROLL_PADDING_PX` of padding (see CutTimeline.tsx, reserved so
  // a `CutMarker` at the very start/end doesn't clip), so `scrollLeft` and
  // `offsetLeft` are offset from each other by that padding rather than
  // lining up directly -- `scrollLeft = 0` shows content starting at
  // `offsetLeft = -TIMELINE_SCROLL_PADDING_PX`, not `0`. Converting through
  // that offset both ways below keeps the two coordinate spaces reconciled.
  // Only adjusts `scrollLeft` when the playhead actually falls outside the
  // current viewport, so it doesn't fight a manual scroll otherwise.
  useEffect(() => {
    const container = scrollContainerRef.current;
    const marker = markerRef.current;
    if (!container || !marker) return;
    const markerX = marker.offsetLeft;
    const viewStart = container.scrollLeft - TIMELINE_SCROLL_PADDING_PX;
    const viewEnd = viewStart + container.clientWidth;
    if (markerX - HANDLE_RADIUS_PX < viewStart) {
      container.scrollLeft = markerX - HANDLE_RADIUS_PX + TIMELINE_SCROLL_PADDING_PX;
    } else if (markerX + HANDLE_RADIUS_PX > viewEnd) {
      container.scrollLeft =
        markerX + HANDLE_RADIUS_PX - container.clientWidth + TIMELINE_SCROLL_PADDING_PX;
    }
  }, [playheadMs, scrollContainerRef]);

  // `sourceMsToOutputMs` returns `null` for any source position that isn't
  // inside a kept segment's range -- this legitimately happens now while
  // playback is paused mid-cut waiting on the next clip's video to become
  // ready (`use-dual-video-playback.ts` intentionally holds `playheadMs` at
  // that real, in-gap position instead of jumping ahead of the still-frozen
  // preview). Falling back to `0` here used to make the marker rocket back
  // to the very start of the timeline for that entire wait -- projecting
  // forward to the upcoming kept segment's boundary instead keeps it sitting
  // right at the cut, matching where the frozen preview actually is.
  const outputPlayheadMs =
    sourceMsToOutputMs(segments, playheadMs) ??
    sourceMsToOutputBoundaryMs(segments, clampedTotal, playheadMs);
  const leftPercent = (outputPlayheadMs / clampedTotal) * 100;

  // Visual-only offset layered on top of `markerRef`'s real (always-correct)
  // `left` position -- lets the marker glide across a cut boundary without
  // ever making the underlying layout position (and thus the scroll-into-view
  // effect above, which reads `offsetLeft`) lag behind the true target.
  const glideOffsetPx = useMotionValue(0);
  const prevJumpTokenRef = useRef(playheadJumpToken);
  const prevMarkerLeftRef = useRef<number | null>(null);
  const glideControlsRef = useRef<ReturnType<typeof animate> | null>(null);

  useLayoutEffect(() => {
    const marker = markerRef.current;
    const jumped = playheadJumpToken !== prevJumpTokenRef.current;
    prevJumpTokenRef.current = playheadJumpToken;

    // Always track the marker's real screen position so the *next* jump (if
    // any) has an accurate "where it glided from" to diff against. This runs
    // every playback frame (since `leftPercent` changes every frame), so it
    // must be unconditional -- but touching `glideOffsetPx` itself must NOT
    // be, or a glide started on the previous frame gets stomped back to 0
    // before it's had a chance to run (this bit us: the animation was being
    // killed after ~16ms instead of playing its full duration).
    const prevMarkerLeft = prevMarkerLeftRef.current;
    const newMarkerLeft = marker?.getBoundingClientRect().left ?? null;
    prevMarkerLeftRef.current = newMarkerLeft;

    if (jumped && marker && prevMarkerLeft !== null && newMarkerLeft !== null) {
      glideControlsRef.current?.stop();
      glideOffsetPx.set(prevMarkerLeft - newMarkerLeft);
      glideControlsRef.current = animate(glideOffsetPx, 0, {
        duration: JUMP_GLIDE_DURATION_S,
        ease: 'easeOut'
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPercent, playheadJumpToken]);

  return (
    <div
      ref={markerRef}
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{ left: `${leftPercent}%` }}
    >
      <motion.div className="absolute inset-y-0 left-0" style={{ x: glideOffsetPx }}>
        <div className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
        <div
          onPointerDown={onPointerDown}
          title="Drag to scrub"
          className="pointer-events-auto absolute top-0 -left-1.5  h-3.5 w-3.5 cursor-ew-resize rounded-full border-2 border-surface bg-accent shadow-sm"
        />
      </motion.div>
    </div>
  );
}
