import { useCallback, type RefObject } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { remapPathToCropSpace } from '@shared/cursor-path';
import { useScreenRecorderStore, EMPTY_CURSOR_PATH } from '../../../store/screen-recorder-store';
import { selectZoomKeyframe } from '../../../store/selection-coordinator';
import { useTimelineStore } from '../store/timeline-store';
import { useZoomStore, findKeyframeContaining } from '../../zoom/store/zoom-store';
import { useCropStore } from '../../crop/store/crop-store';
import { resolveFixedPosition } from '../../zoom/lib/resolve-fixed-position';
import { outputMsToSourceMs } from './segment-duration';

interface UseTimelineClickRouterOptions {
  /** The shared zoom-scaled track row every row's percent-based math is computed against -- see CutTimeline.tsx. */
  trackAreaRef: RefObject<HTMLDivElement | null>;
  segments: TimelineSegment[];
  clampedTotal: number;
}

/**
 * Whole-track-area click handling shared between the ruler and the clip
 * row: a plain seek, plus the cut/zoom tool's "click anywhere on the
 * timeline" behavior -- computed from the cursor's fraction across the
 * *whole* track area (not the specific segment/tick clicked), since
 * `splitAt` takes an output-ms position and figures out which kept segment
 * covers it internally, and a zoom keyframe is placed the same way. That
 * means every click target on the timeline (ruler, or any clip pill) can
 * share this one calculation instead of each needing its own per-segment
 * bounds math.
 */
export function useTimelineClickRouter({
  trackAreaRef,
  segments,
  clampedTotal
}: UseTimelineClickRouterOptions): {
  isCutToolActive: boolean;
  isZoomToolActive: boolean;
  /** Either tool armed -- both suppress the clip row's normal select/drag/resize/double-click-to-split interactions the same way. */
  isPointerToolActive: boolean;
  seekFromClientX: (clientX: number) => void;
  /** Cut/zoom tool's shared click handling -- runs the armed tool's action and returns `true` if one was armed, so callers can skip their own default click behavior (seek, select, ...) when this already handled it. */
  routeToolClick: (clientX: number) => boolean;
} {
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const splitAt = useTimelineStore((s) => s.splitAt);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  // Armed from the Scissors button in EditorTransportBar -- while true, a
  // click anywhere on the timeline (ruler or clip row) performs a split at
  // the cursor instead of seeking/selecting.
  const isCutToolActive = useTimelineStore((s) => s.isCutToolActive);
  // Armed from the ZoomIn button -- same idea, but a click adds a zoom
  // keyframe at the cursor instead of splitting; ZoomTrack gets the hovered
  // position as a prop (see CutTimeline.tsx) and draws its own ghost preview.
  const isZoomToolActive = useTimelineStore((s) => s.isZoomToolActive);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const addZoomKeyframe = useZoomStore((s) => s.addKeyframe);
  const updateZoomKeyframe = useZoomStore((s) => s.updateKeyframe);
  const clickPath = useScreenRecorderStore((s) => s.lastRecording?.clickPath ?? EMPTY_CURSOR_PATH);
  const cursorPath = useScreenRecorderStore(
    (s) => s.lastRecording?.cursorPath ?? EMPTY_CURSOR_PATH
  );
  const activeCrop = useCropStore((s) => s.rect);

  const fractionFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = trackAreaRef.current;
      if (!el || segments.length === 0) return null;
      const rect = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    },
    [trackAreaRef, segments]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const fraction = fractionFromClientX(clientX);
      if (fraction === null) return;
      const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
      if (sourceMs !== null) requestSeek(sourceMs);
    },
    [fractionFromClientX, segments, clampedTotal, requestSeek]
  );

  const splitFromClientX = useCallback(
    (clientX: number) => {
      const fraction = fractionFromClientX(clientX);
      if (fraction === null) return;
      splitAt(fraction * clampedTotal);
    },
    [fractionFromClientX, clampedTotal, splitAt]
  );

  // Zoom tool's click-to-place -- mapped to a *source*-ms position (zoom
  // keyframes are authored against the source recording, not the output
  // timeline -- see PillTrack.tsx) instead of handed to `splitAt` directly.
  // No-ops over a stretch that already has a keyframe -- ZoomTrack hides its
  // ghost there for the same reason (see ZoomTrack.tsx): a click wouldn't
  // add one *here*, it'd silently snap in right after the existing one
  // (clampToNonOverlapping, zoom-store.ts), which isn't what a click on an
  // already-covered stretch should do.
  //
  // `addZoomKeyframe` always creates with `position: 'auto-cursor'`, since
  // that's also the right default for `ZoomKeyframeEditor`'s own "Add
  // keyframe" button -- but a deliberate click on an exact point of the
  // timeline (what the ghost preview promises, see ZoomTrack.tsx) reads more
  // as "zoom in on whatever's here" than "start tracking the mouse for the
  // next few seconds", so this path immediately follows up with a fixed
  // position instead, same resolution `ZoomTrack`'s "disable follow cursor"
  // uses. Reads the just-created keyframe back from the store (rather than
  // the requested `sourceMs`/default duration) since `addZoomKeyframe`
  // clamps both against neighboring keyframes.
  const placeZoomKeyframeFromClientX = useCallback(
    (clientX: number) => {
      const fraction = fractionFromClientX(clientX);
      if (fraction === null) return;
      const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
      if (sourceMs === null) return;
      if (findKeyframeContaining(zoomKeyframes, sourceMs)) return;
      const id = addZoomKeyframe(sourceMs);
      const created = useZoomStore.getState().keyframes.find((kf) => kf.id === id);
      if (created) {
        // Fixed `position` is consumed as a fraction of the (possibly
        // cropped) content box -- see ZoomTrack.tsx's identical remap.
        updateZoomKeyframe(id, {
          position: resolveFixedPosition(
            remapPathToCropSpace(clickPath, activeCrop),
            remapPathToCropSpace(cursorPath, activeCrop),
            created.atMs,
            created.durationMs
          )
        });
      }
      selectZoomKeyframe(id);
      setActiveTool('zoom');
    },
    [
      fractionFromClientX,
      segments,
      clampedTotal,
      zoomKeyframes,
      addZoomKeyframe,
      updateZoomKeyframe,
      clickPath,
      cursorPath,
      activeCrop,
      setActiveTool
    ]
  );

  const routeToolClick = useCallback(
    (clientX: number): boolean => {
      if (isCutToolActive) {
        splitFromClientX(clientX);
        return true;
      }
      if (isZoomToolActive) {
        placeZoomKeyframeFromClientX(clientX);
        return true;
      }
      return false;
    },
    [isCutToolActive, isZoomToolActive, splitFromClientX, placeZoomKeyframeFromClientX]
  );

  return {
    isCutToolActive,
    isZoomToolActive,
    isPointerToolActive: isCutToolActive || isZoomToolActive,
    seekFromClientX,
    routeToolClick
  };
}
