import type { JSX } from 'react';
import { Mouse, Target, ZoomIn } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { CLIP_ROW_HEIGHT_PX } from '../../timeline/lib/assign-lanes';
import { PillTrack } from '../../timeline/components/PillTrack';
import { useZoomStore } from '../store/zoom-store';
import { MIN_DURATION_MS, MAX_DURATION_MS } from './ZoomKeyframeEditor';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compact visual companion to `ZoomKeyframeEditor` (the real editing
 * surface, in the right-hand tool panel) -- see PillTrack.tsx for the
 * shared drag/resize/lane-out mechanics. Clicking a pill seeks there and
 * brings the Zoom panel into focus on that keyframe's own card, rather than
 * this compact overview trying to be the real editor (see
 * ZoomKeyframeEditor's scroll-to effect keyed on `selectedKeyframeId`).
 */
export function ZoomTrack(): JSX.Element | null {
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

  return (
    <PillTrack
      items={keyframes}
      segments={segments}
      getStartMs={(kf) => kf.atMs}
      getDurationMs={(kf) => kf.durationMs}
      isSelected={(kf) => selectedKeyframeId === kf.id}
      getTitle={(kf) =>
        `${kf.depth.toFixed(1)}x at ${(kf.atMs / 1000).toFixed(1)}s -- ${
          kf.position === 'auto-cursor' ? 'follows cursor' : 'fixed point'
        } -- drag to move, edges to trim`
      }
      // Dark-border + text treatment as CutTimeline's clip segments (see
      // CutTimeline.tsx) -- the fill/highlight gradients themselves are two
      // stacked layers in renderContent below, not a background class here,
      // for exact parity with how the clip bar layers its own. Scoped to
      // ZoomTrack alone (colorClassName is applied as-is by PillTrack, so
      // CaptionTrack/AnnotationTrack/BlurMaskTrack, which share PillTrack,
      // are unaffected).
      colorClassName="border-purple-900/40 text-purple-950"
      handleClassName="bg-black/10 hover:bg-black/25"
      // Taller than the default single-line pill (see PillTrack.tsx's
      // `laneHeightPx`) so a "Zoom" title row can sit above the icon row,
      // matching the reference's two-line badge -- scoped to this track
      // alone, doesn't affect Caption/Annotation/BlurMask's lane math. Uses
      // the clip row's own height so the two stay visually consistent
      // instead of coincidentally matching magic numbers.
      laneHeightPx={CLIP_ROW_HEIGHT_PX}
      renderContent={(kf) => (
        <>
          {/* Same two-layer gradient as the clip bar's background
              (CutTimeline.tsx): a base color fill, then a light-at-bottom
              -fading-to-dark-at-top highlight on top, just purple instead
              of amber. Needs the sibling `relative` wrapper below so its
              (in-flow, non-positioned) content still paints above these
              (positioned) layers -- see CutTimeline.tsx's segments/
              background layers for the same ordering concern. */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-purple-400 via-purple-500 to-purple-600" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
          <div className="relative flex flex-col items-center justify-center gap-0.5 leading-none">
            <span className="text-[9px] font-semibold text-purple-950">Zoom</span>
            <span className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="flex items-center gap-1">
                <ZoomIn size={11} className="shrink-0" />
                {kf.depth.toFixed(1)}×
              </span>
              <span className="flex items-center gap-1">
                {kf.position === 'auto-cursor' ? <Mouse size={11} /> : <Target size={10} />}
                {kf.position === 'auto-cursor' ? 'Auto' : 'Manual'}
              </span>
            </span>
          </div>
        </>
      )}
      onSelect={(kf) => {
        requestSeek(kf.atMs);
        setActiveTool('zoom');
        setSelectedKeyframeId(kf.id);
      }}
      onMove={(kf, atMs) => updateKeyframe(kf.id, { atMs })}
      onResizeStart={(kf, newAtMs) => {
        const endMs = kf.atMs + kf.durationMs;
        const clampedAtMs = Math.min(newAtMs, endMs - MIN_DURATION_MS);
        updateKeyframe(kf.id, {
          atMs: clampedAtMs,
          durationMs: clamp(endMs - clampedAtMs, MIN_DURATION_MS, MAX_DURATION_MS)
        });
      }}
      onResizeEnd={(kf, newEndMs) => {
        updateKeyframe(kf.id, {
          durationMs: clamp(newEndMs - kf.atMs, MIN_DURATION_MS, MAX_DURATION_MS)
        });
      }}
      onDelete={(kf) => removeKeyframe(kf.id)}
    />
  );
}
