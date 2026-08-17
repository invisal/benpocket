import type { JSX } from 'react';
import { useMemo } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { CLIP_ROW_HEIGHT_PX } from '../lib/assign-lanes';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import type { useEdgeResize } from '../lib/use-edge-resize';
import { ClipPill } from './ClipPill';
import { CutMarker } from './CutMarker';

// Taller than a plain pill track (`CLIP_ROW_HEIGHT_PX`) -- clips carry a
// two-line label (name + duration/speed), not just a single corner badge.
const CLIP_PILL_HEIGHT_PX = CLIP_ROW_HEIGHT_PX * 1.4;
// Space reserved above the row for the floating pin-shaped cut markers,
// whose tip touches the row's top edge.
const CUT_MARKER_RESERVED_PX = 10;

interface ClipRowProps {
  segments: TimelineSegment[];
  clampedTotal: number;
  isEdgeResizing: boolean;
  startResize: ReturnType<typeof useEdgeResize>['startResize'];
  isPointerToolActive: boolean;
  isCutToolActive: boolean;
  routeToolClick: (clientX: number) => boolean;
  /** Ruler/row hover-scrub position (see use-hover-scrub.ts), 0-1 or `null` while not hovering -- drives the cut tool's live preview pin below. */
  effectiveHoverFraction: number | null;
}

/**
 * Kept clips draw as individual rounded pills with a real gap between them
 * (not one continuous bar) -- each pill is absolutely positioned from its
 * own left/width percent rather than laid out with a flex `gap`, so the
 * percentages stay exact and every other track's percent-based math (ruler
 * ticks, playhead) keeps lining up regardless of clip count.
 */
export function ClipRow({
  segments,
  clampedTotal,
  isEdgeResizing,
  startResize,
  isPointerToolActive,
  isCutToolActive,
  routeToolClick,
  effectiveHoverFraction
}: ClipRowProps): JSX.Element {
  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();

  // Each pill's left/width percent, laid out edge-to-edge in output order --
  // computed once here (rather than inline per-segment) since ClipPill's
  // own cut-marker duration needs the same running cursor to find clip
  // boundaries.
  const segmentLayouts = useMemo(
    () =>
      segments.reduce<{
        list: { segment: TimelineSegment; leftPercent: number; widthPercent: number }[];
        cursorMs: number;
      }>(
        (acc, segment) => {
          const outputDurationMs = getSegmentOutputDurationMs(segment);
          const leftPercent = (acc.cursorMs / clampedTotal) * 100;
          const widthPercent = (outputDurationMs / clampedTotal) * 100;
          return {
            list: [...acc.list, { segment, leftPercent, widthPercent }],
            cursorMs: acc.cursorMs + outputDurationMs
          };
        },
        { list: [], cursorMs: 0 }
      ).list,
    [segments, clampedTotal]
  );

  return (
    <div
      className="relative"
      style={{ height: CLIP_PILL_HEIGHT_PX, marginTop: CUT_MARKER_RESERVED_PX }}
    >
      {segmentLayouts.map(({ segment, leftPercent, widthPercent }, index) => (
        <ClipPill
          key={segment.id}
          segment={segment}
          index={index}
          segments={segments}
          leftPercent={leftPercent}
          widthPercent={widthPercent}
          dragOverIndex={dragOverIndex}
          dragHandlers={getDragHandlers(index)}
          isEdgeResizing={isEdgeResizing}
          startResize={startResize}
          isPointerToolActive={isPointerToolActive}
          routeToolClick={routeToolClick}
        />
      ))}

      {/*
        Cut tool's live preview -- the same pin shape as a real cut marker,
        but with no duration (nothing's actually been cut yet) and following
        the cursor continuously rather than sitting fixed at a clip
        boundary. Rendered inside this same clip-row container (not the
        outer ruler+row wrapper) so its `-top-*` offset is relative to the
        row's own top edge, exactly like the real markers.
      */}
      {isCutToolActive && effectiveHoverFraction !== null && (
        <div
          className="pointer-events-none absolute top-0 z-20"
          style={{ left: `${effectiveHoverFraction * 100}%` }}
        >
          <CutMarker anchorClassName="-translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
