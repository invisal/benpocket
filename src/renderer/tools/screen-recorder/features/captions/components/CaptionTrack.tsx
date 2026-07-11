import type { JSX } from 'react';
import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import {
  getSegmentOutputDurationMs,
  sourceRangeToOutputPercent
} from '../../timeline/lib/segment-duration';
import {
  assignLanes,
  laneCount,
  LANE_HEIGHT_PX,
  LANE_GAP_PX
} from '../../timeline/lib/assign-lanes';
import { usePillDrag } from '../../timeline/lib/use-pill-drag';
import { useEdgeResize } from '../../timeline/lib/use-edge-resize';
import { useCaptionsStore } from '../store/captions-store';

const MIN_CAPTION_DURATION_MS = 300;

/**
 * Pill track for caption segments, matching Zoom/Speed/Crop/Trim -- see
 * ZoomTrack.tsx for why pills are mapped through `sourceRangeToOutputPercent`
 * rather than assuming nothing's been cut, and why overlapping captions are
 * laid out via `assignLanes` rather than drawn on top of each other.
 * Click a pill to seek there, drag its body to move the whole caption
 * (start/end shift together, duration preserved -- see usePillDrag), or
 * drag either edge to trim just that side (see useEdgeResize).
 */
export function CaptionTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const captionSegments = useCaptionsStore((s) => s.segments);
  const updateSegment = useCaptionsStore((s) => s.updateSegment);

  const totalOutputMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startDrag, didDragRef } = usePillDrag({ containerRef, segments, totalOutputMs });
  const { startResize } = useEdgeResize();

  const laned = assignLanes(captionSegments, (caption) =>
    sourceRangeToOutputPercent(segments, totalOutputMs, caption.startMs, caption.endMs)
  );
  const trackHeightPx =
    Math.max(1, laneCount(laned)) * LANE_HEIGHT_PX +
    Math.max(0, laneCount(laned) - 1) * LANE_GAP_PX;
  if (laned.length === 0) return <div />;
  return (
    <div className="flex shrink-0 items-center py-1">
      <div ref={containerRef} className="relative flex-1" style={{ height: trackHeightPx }}>
        {laned.map(({ item: caption, position, lane }) => {
          const durationMs = caption.endMs - caption.startMs;
          return (
            <div
              key={caption.id}
              onPointerDown={startDrag(caption.startMs, (startMs) =>
                updateSegment(caption.id, { startMs, endMs: startMs + durationMs })
              )}
              onClick={() => {
                if (!didDragRef.current) requestSeek(caption.startMs);
              }}
              title={`${caption.text} -- drag to move, edges to trim`}
              className="group absolute flex cursor-grab items-center gap-1 overflow-hidden rounded-full border border-yellow-600/50 bg-yellow-700/30 px-2 text-yellow-100 hover:bg-yellow-700/45 active:cursor-grabbing"
              style={{
                left: `${position.leftPercent}%`,
                width: `${position.widthPercent}%`,
                top: lane * (LANE_HEIGHT_PX + LANE_GAP_PX),
                height: LANE_HEIGHT_PX
              }}
            >
              <MessageSquare size={10} className="shrink-0" />
              <span className="truncate text-[10px] font-medium">{caption.text}</span>

              <div
                onPointerDown={(e) => {
                  const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                  startResize(caption.startMs, durationMs, width, (newStartMs) => {
                    const startMs = Math.min(newStartMs, caption.endMs - MIN_CAPTION_DURATION_MS);
                    updateSegment(caption.id, { startMs });
                  })(e);
                }}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 hover:bg-white/25 group-hover:opacity-100"
              />
              <div
                onPointerDown={(e) => {
                  const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                  startResize(caption.endMs, durationMs, width, (newEndMs) => {
                    const endMs = Math.max(newEndMs, caption.startMs + MIN_CAPTION_DURATION_MS);
                    updateSegment(caption.id, { endMs });
                  })(e);
                }}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 hover:bg-white/25 group-hover:opacity-100"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
