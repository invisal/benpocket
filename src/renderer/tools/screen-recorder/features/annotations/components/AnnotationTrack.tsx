import type { JSX } from 'react';
import { ArrowUpRight, ImagePlus, Type } from 'lucide-react';
import type { Annotation } from '@screen-recorder/types/project';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { CLIP_ROW_HEIGHT_PX } from '../../timeline/lib/assign-lanes';
import { PillTrack } from '../../timeline/components/PillTrack';
import { useAnnotationsStore } from '../store/annotations-store';

const MIN_ANNOTATION_DURATION_MS = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function annotationLabel(annotation: Annotation): string {
  if (annotation.kind === 'text') return annotation.text || 'Text';
  if (annotation.kind === 'arrow') return 'Arrow';
  return 'Image';
}

/**
 * Compact visual companion to `AnnotationsPanel` (the real editing surface,
 * in the right-hand tool panel) -- see PillTrack.tsx for the shared
 * drag/resize/lane-out mechanics. Clicking a pill selects that annotation,
 * seeks there, and opens the Annotations panel, same pattern as ZoomTrack.
 */
export function AnnotationTrack(): JSX.Element | null {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const annotations = useAnnotationsStore((s) => s.annotations);
  const updateAnnotation = useAnnotationsStore((s) => s.updateAnnotation);
  const removeAnnotation = useAnnotationsStore((s) => s.removeAnnotation);
  const selectedAnnotationId = useAnnotationsStore((s) => s.selectedAnnotationId);
  const setSelectedAnnotationId = useAnnotationsStore((s) => s.setSelectedAnnotationId);

  return (
    <PillTrack
      items={annotations}
      segments={segments}
      getStartMs={(a) => a.atMs}
      getDurationMs={(a) => a.durationMs}
      isSelected={(a) => selectedAnnotationId === a.id}
      getTitle={(a) =>
        `${annotationLabel(a)} at ${(a.atMs / 1000).toFixed(1)}s -- drag to move, edges to trim`
      }
      // Same gradient-fill + dark-border/text + title-row treatment as
      // ZoomTrack (see ZoomTrack.tsx and CutTimeline.tsx's clip segments),
      // in pink instead of purple -- ZoomTrack claimed purple/violet, so
      // this moved off it to stay visually distinguishable.
      colorClassName="border-pink-900/40 text-pink-950"
      handleClassName="bg-black/10 hover:bg-black/25"
      laneHeightPx={CLIP_ROW_HEIGHT_PX}
      renderContent={(a) => {
        const Icon = a.kind === 'text' ? Type : a.kind === 'arrow' ? ArrowUpRight : ImagePlus;
        return (
          <>
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-pink-200 via-pink-400 to-pink-600" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
            <div className="relative flex flex-col items-center justify-center gap-0.5 leading-none">
              <span className="text-[9px] font-semibold text-pink-950/70">Annotation</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold">
                <Icon size={11} className="shrink-0" />
                {annotationLabel(a)}
              </span>
            </div>
          </>
        );
      }}
      onSelect={(a) => {
        requestSeek(a.atMs);
        setActiveTool('annotations');
        setSelectedAnnotationId(a.id);
      }}
      onMove={(a, atMs) => updateAnnotation(a.id, { atMs })}
      onResizeStart={(a, newAtMs) => {
        const endMs = a.atMs + a.durationMs;
        const clampedAtMs = Math.min(newAtMs, endMs - MIN_ANNOTATION_DURATION_MS);
        updateAnnotation(a.id, {
          atMs: clampedAtMs,
          durationMs: clamp(endMs - clampedAtMs, MIN_ANNOTATION_DURATION_MS, Infinity)
        });
      }}
      onResizeEnd={(a, newEndMs) => {
        updateAnnotation(a.id, {
          durationMs: clamp(newEndMs - a.atMs, MIN_ANNOTATION_DURATION_MS, Infinity)
        });
      }}
      onDelete={(a) => removeAnnotation(a.id)}
    />
  );
}
