import type { JSX } from 'react';
import { Droplets, Square } from 'lucide-react';
import type { BlurMaskRegion } from '@screen-recorder/types/project';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { CLIP_ROW_HEIGHT_PX } from '../../timeline/lib/assign-lanes';
import { PillTrack } from '../../timeline/components/PillTrack';
import { useBlurMaskStore } from '../store/blur-mask-store';

const MIN_REGION_DURATION_MS = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function regionLabel(region: BlurMaskRegion): string {
  return region.kind === 'blur' ? 'Blur' : 'Mask';
}

/**
 * Compact visual companion to `BlurMaskPanel` (the real editing surface, in
 * the right-hand tool panel) -- see PillTrack.tsx for the shared
 * drag/resize/lane-out mechanics. Clicking a pill selects that region, seeks
 * there, and opens the Blur/Mask panel, same pattern as AnnotationTrack.
 */
export function BlurMaskTrack(): JSX.Element | null {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const regions = useBlurMaskStore((s) => s.regions);
  const updateRegion = useBlurMaskStore((s) => s.updateRegion);
  const removeRegion = useBlurMaskStore((s) => s.removeRegion);
  const selectedRegionId = useBlurMaskStore((s) => s.selectedRegionId);
  const setSelectedRegionId = useBlurMaskStore((s) => s.setSelectedRegionId);

  return (
    <PillTrack
      items={regions}
      segments={segments}
      getStartMs={(r) => r.atMs}
      getDurationMs={(r) => r.durationMs}
      isSelected={(r) => selectedRegionId === r.id}
      getTitle={(r) =>
        `${regionLabel(r)} at ${(r.atMs / 1000).toFixed(1)}s -- drag to move, edges to trim`
      }
      // Same gradient-fill + dark-border/text + title-row treatment as
      // ZoomTrack (see ZoomTrack.tsx and CutTimeline.tsx's clip segments),
      // in sky instead of purple so tracks stay visually distinguishable.
      colorClassName="border-sky-900/40 text-sky-950"
      handleClassName="bg-black/10 hover:bg-black/25"
      laneHeightPx={CLIP_ROW_HEIGHT_PX}
      renderContent={(r) => {
        const Icon = r.kind === 'blur' ? Droplets : Square;
        return (
          <>
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-sky-200 via-sky-400 to-sky-600" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
            <div className="relative flex flex-col items-center justify-center gap-0.5 leading-none">
              <span className="text-[9px] font-semibold text-sky-950/70">Blur / Mask</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold">
                <Icon size={11} className="shrink-0" />
                {regionLabel(r)}
              </span>
            </div>
          </>
        );
      }}
      onSelect={(r) => {
        requestSeek(r.atMs);
        setActiveTool('blur-mask');
        setSelectedRegionId(r.id);
      }}
      onMove={(r, atMs) => updateRegion(r.id, { atMs })}
      onResizeStart={(r, newAtMs) => {
        const endMs = r.atMs + r.durationMs;
        const clampedAtMs = Math.min(newAtMs, endMs - MIN_REGION_DURATION_MS);
        updateRegion(r.id, {
          atMs: clampedAtMs,
          durationMs: clamp(endMs - clampedAtMs, MIN_REGION_DURATION_MS, Infinity)
        });
      }}
      onResizeEnd={(r, newEndMs) => {
        updateRegion(r.id, {
          durationMs: clamp(newEndMs - r.atMs, MIN_REGION_DURATION_MS, Infinity)
        });
      }}
      onDelete={(r) => removeRegion(r.id)}
    />
  );
}
