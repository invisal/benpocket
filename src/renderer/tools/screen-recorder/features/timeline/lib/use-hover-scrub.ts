import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { useTimelineStore } from '../store/timeline-store';
import { outputMsToSourceMs } from './segment-duration';

interface UseHoverScrubOptions {
  trackAreaRef: RefObject<HTMLDivElement | null>;
  segments: TimelineSegment[];
  clampedTotal: number;
  seekFromClientX: (clientX: number) => void;
  /** Set while the *main* playhead is being dragged (see use-playhead-drag.ts) -- hover-scrub steps aside rather than fighting that interaction. */
  playheadDraggingRef: RefObject<boolean>;
  /** Set while a clip/pill edge is being resized (see use-edge-resize.ts) -- same reasoning. */
  edgeResizingRef: RefObject<boolean>;
}

/**
 * A second, gray playhead that tracks the cursor while it's over the ruler
 * and live-seeks the preview video to that position -- scrubbing by hover
 * alone, no click/drag needed. `preHoverPlayheadMsRef` remembers where
 * playback actually was before the hover started, so moving the mouse away
 * without clicking (`handlePointerLeave`) snaps the preview back instead of
 * leaving it wherever the cursor last was; a real click/drag instead calls
 * `cancelHover` and commits its own seek right after, so the leave-restore
 * never gets a chance to undo it.
 */
export function useHoverScrub({
  trackAreaRef,
  segments,
  clampedTotal,
  seekFromClientX,
  playheadDraggingRef,
  edgeResizingRef
}: UseHoverScrubOptions): {
  effectiveHoverFraction: number | null;
  handlePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerLeave: () => void;
  /** Clears the hover baseline (including `isHoverScrubbing` in the store) -- for callers about to commit their own seek right after (a real ruler click, or the main playhead taking over the drag), so the hover state doesn't linger or fight what they're about to do. */
  cancelHover: () => void;
} {
  const previewSeek = useTimelineStore((s) => s.previewSeek);
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const setIsHoverScrubbing = useTimelineStore((s) => s.setIsHoverScrubbing);
  // Gates hover-scrub below -- only toggles on play/pause (not a 60fps
  // concern like `playheadMs`), so subscribing directly here is fine.
  const isPlaying = useTimelineStore((s) => s.isPlaying);

  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const preHoverPlayheadMsRef = useRef<number | null>(null);

  // Playback starting mid-hover (transport bar, spacebar, ...) invalidates
  // the "position to restore on leave" baseline -- clearing just the ref
  // (not React state, so this doesn't fight the set-state-in-effect rule)
  // means a leave-while-playing won't snap playback back to wherever it
  // happened to be when the hover started. The stale `hoverFraction` value
  // itself is masked at render time below (`effectiveHoverFraction`)
  // instead of being reset here, since real playback should just keep
  // going from wherever it already is, not trigger another render.
  // `setIsHoverScrubbing` is a zustand action, not React state, so it's
  // exempt from that same rule -- and it has to be cleared here too, or a
  // hover interrupted by playback starting would leave PreviewStage's rAF
  // loop permanently skipping `setPlayhead`, freezing the main playhead
  // forever even once paused again.
  useEffect(() => {
    if (isPlaying) {
      preHoverPlayheadMsRef.current = null;
      setIsHoverScrubbing(false);
    }
  }, [isPlaying, setIsHoverScrubbing]);
  const effectiveHoverFraction = isPlaying ? null : hoverFraction;

  const cancelHover = useCallback(() => {
    setHoverFraction(null);
    preHoverPlayheadMsRef.current = null;
    setIsHoverScrubbing(false);
  }, [setIsHoverScrubbing]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ignore events bubbled here from a portaled ContextMenu (React
      // bubbles through the component tree, not the DOM tree).
      if (!event.currentTarget.contains(event.target as Node)) return;
      // Hover-scrub only live-previews while paused -- while actually
      // playing back, a hovering mouse shouldn't fight the running playback
      // position. Dragging the *main* playhead handle still works
      // regardless of play state. Also off while the cursor is mid-drag on
      // something else draggable (a clip edge being resized), so
      // hover-scrub doesn't fight that interaction either.
      if (isPlaying || playheadDraggingRef.current || edgeResizingRef.current) return;
      const el = trackAreaRef.current;
      if (!el || segments.length === 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setHoverFraction(fraction);

      if (preHoverPlayheadMsRef.current === null) {
        preHoverPlayheadMsRef.current = useTimelineStore.getState().playheadMs;
        setIsHoverScrubbing(true);
      }
      // `previewSeek` (not `requestSeek`) -- moves the actual video so the
      // preview shows this frame, but deliberately leaves `playheadMs`
      // alone so the *main* blue playhead stays put and only the gray
      // hover marker (positioned from `hoverFraction` above) follows the
      // cursor. The main playhead only catches up once the hover is
      // committed or cancelled (see handlePointerUp/handlePointerLeave).
      const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
      if (sourceMs !== null) previewSeek(sourceMs);
    },
    [
      isPlaying,
      playheadDraggingRef,
      edgeResizingRef,
      trackAreaRef,
      segments,
      clampedTotal,
      setIsHoverScrubbing,
      previewSeek
    ]
  );

  // Releasing the mouse anywhere over the hover-scrub area (ruler or clip
  // row) commits the current cursor position as the real seek -- reached
  // via pointerup so this also covers releasing over a clip (which
  // separately selects it). Uses `requestSeek` (not `previewSeek`), so this
  // is the moment the main playhead actually jumps to the released
  // position. Skipped while playing, dragging the main playhead, or
  // mid-edge-resize, same as `handlePointerMove` -- releasing off the end
  // of one of those interactions shouldn't also fire a seek.
  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.target as Node)) return;
      // A right-click also fires pointerup (unlike the native `click`
      // event a real click uses, which is left-button only) -- without
      // this, opening a clip's context menu would also seek.
      if (event.button === 2) return;
      if (isPlaying || playheadDraggingRef.current || edgeResizingRef.current) return;
      cancelHover();
      seekFromClientX(event.clientX);
    },
    [isPlaying, playheadDraggingRef, edgeResizingRef, cancelHover, seekFromClientX]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverFraction(null);
    if (preHoverPlayheadMsRef.current !== null) {
      setIsHoverScrubbing(false);
      requestSeek(preHoverPlayheadMsRef.current);
      preHoverPlayheadMsRef.current = null;
    }
  }, [setIsHoverScrubbing, requestSeek]);

  return {
    effectiveHoverFraction,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    cancelHover
  };
}
