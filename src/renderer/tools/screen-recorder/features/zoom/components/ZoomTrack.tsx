import type { JSX } from 'react';
import { Mouse, Target, ZoomIn } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
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
      colorClassName="border-emerald-400/50 bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/45"
      renderContent={(kf) => (
        <>
          <ZoomIn size={10} className="shrink-0" />
          <span className="truncate text-[10px] font-medium">{kf.depth.toFixed(1)}×</span>
          <span className="flex shrink-0 items-center gap-0.5 text-emerald-200/70">
            {kf.position === 'auto-cursor' ? <Mouse size={10} /> : <Target size={9} />}
            <span className="text-[9px] font-medium">
              {kf.position === 'auto-cursor' ? 'Auto' : 'Manual'}
            </span>
          </span>
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
