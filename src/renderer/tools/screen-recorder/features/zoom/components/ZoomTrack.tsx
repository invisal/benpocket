import type { JSX } from 'react';
import { useRef } from 'react';
import { ArrowUpRight, Target, Trash2, ZoomIn } from 'lucide-react';
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
import { useZoomStore } from '../store/zoom-store';
import { MIN_DURATION_MS, MAX_DURATION_MS } from './ZoomKeyframeEditor';
import { cn } from '../../../lib/utils';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compact visual companion to `ZoomKeyframeEditor` (the real editing
 * surface, in the right-hand tool panel) -- shows what zoom keyframes exist
 * underneath the cut timeline, as pill chips matching the other per-tool
 * tracks (Trim/Speed/Crop). Click a pill to seek there, drag its body to
 * move the keyframe (see usePillDrag), or drag either edge to trim its
 * duration (see useEdgeResize) -- the same "grab an edge" interaction the
 * main clip row has always had.
 *
 * Keyframe `atMs` is authored against the *source* recording's raw
 * timeline (same convention captions/annotations use elsewhere), but pills
 * are drawn on the ripple/*output* timeline CutTimeline draws -- mapped via
 * `sourceRangeToOutputPercent`, so this stays correctly positioned even
 * after the recording's been split/trimmed, not just in the untouched case.
 * A keyframe entirely inside a cut-out gap is simply not drawn.
 *
 * Keyframes packed close together in time would otherwise draw on top of
 * each other (they're all absolutely positioned in the same row) -- laid
 * out via `assignLanes` instead, so overlapping ones stack into extra rows
 * and the track grows tall enough to fit them all legibly.
 */
export function ZoomTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const keyframes = useZoomStore((s) => s.keyframes);
  const updateKeyframe = useZoomStore((s) => s.updateKeyframe);
  const removeKeyframe = useZoomStore((s) => s.removeKeyframe);
  const selectedKeyframeId = useZoomStore((s) => s.selectedKeyframeId);
  const setSelectedKeyframeId = useZoomStore((s) => s.setSelectedKeyframeId);

  const totalOutputMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startDrag, didDragRef } = usePillDrag({ containerRef, segments, totalOutputMs });
  const { startResize } = useEdgeResize();

  const laned = assignLanes(keyframes, (kf) =>
    sourceRangeToOutputPercent(segments, totalOutputMs, kf.atMs, kf.atMs + kf.durationMs)
  );
  const trackHeightPx =
    Math.max(1, laneCount(laned)) * LANE_HEIGHT_PX +
    Math.max(0, laneCount(laned) - 1) * LANE_GAP_PX;
  if (laned.length === 0) return <div />;
  return (
    <div className="flex shrink-0 items-center py-1">
      <div ref={containerRef} className="relative flex-1" style={{ height: trackHeightPx }}>
        {laned.map(({ item: kf, position, lane }) => {
          const endMs = kf.atMs + kf.durationMs;
          return (
            <div
              key={kf.id}
              onPointerDown={startDrag(kf.atMs, (atMs) => updateKeyframe(kf.id, { atMs }))}
              onClick={() => {
                if (didDragRef.current) return;
                requestSeek(kf.atMs);
                // Bring the Zoom panel into focus, on this keyframe's own
                // card, so its depth/duration/position fields are right
                // there to edit -- ZoomTrack is just a compact overview,
                // not the real editor (see ZoomKeyframeEditor's scroll-to
                // effect keyed on `selectedKeyframeId`).
                setActiveTool('zoom');
                setSelectedKeyframeId(kf.id);
              }}
              title={`${kf.depth.toFixed(1)}x at ${(kf.atMs / 1000).toFixed(1)}s -- ${
                kf.position === 'auto-cursor' ? 'follows cursor' : 'fixed point'
              } -- drag to move, edges to trim`}
              className={cn(
                'group absolute flex cursor-grab items-center gap-1 overflow-hidden rounded-full border border-emerald-400/50 bg-emerald-600/30 px-2 text-emerald-100 hover:bg-emerald-600/45 active:cursor-grabbing',
                selectedKeyframeId === kf.id && 'ring-2 ring-white/70'
              )}
              style={{
                left: `${position.leftPercent}%`,
                width: `${position.widthPercent}%`,
                top: lane * (LANE_HEIGHT_PX + LANE_GAP_PX),
                height: LANE_HEIGHT_PX
              }}
            >
              <ZoomIn size={10} className="shrink-0" />
              <span className="truncate text-[10px] font-medium">{kf.depth.toFixed(1)}×</span>
              {kf.position === 'auto-cursor' ? (
                <ArrowUpRight size={9} className="shrink-0 text-emerald-200/70" />
              ) : (
                <Target size={9} className="shrink-0 text-emerald-200/70" />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeKeyframe(kf.id);
                }}
                title="Delete keyframe"
                className="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white/70 hover:text-red-400 group-hover:flex"
              >
                <Trash2 size={11} />
              </button>

              <div
                onPointerDown={(e) => {
                  const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                  startResize(kf.atMs, kf.durationMs, width, (newAtMs) => {
                    const clampedAtMs = Math.min(newAtMs, endMs - MIN_DURATION_MS);
                    updateKeyframe(kf.id, {
                      atMs: clampedAtMs,
                      durationMs: clamp(endMs - clampedAtMs, MIN_DURATION_MS, MAX_DURATION_MS)
                    });
                  })(e);
                }}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 hover:bg-white/25 group-hover:opacity-100"
              />
              <div
                onPointerDown={(e) => {
                  const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                  startResize(endMs, kf.durationMs, width, (newEndMs) => {
                    updateKeyframe(kf.id, {
                      durationMs: clamp(newEndMs - kf.atMs, MIN_DURATION_MS, MAX_DURATION_MS)
                    });
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
