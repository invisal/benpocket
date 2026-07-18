import type { JSX } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { CLIP_ROW_HEIGHT_PX } from '../../timeline/lib/assign-lanes';
import { PillTrack } from '../../timeline/components/PillTrack';
import { useCaptionsStore } from '../store/captions-store';

const MIN_CAPTION_DURATION_MS = 300;

/**
 * Pill track for caption segments -- see PillTrack.tsx for the shared
 * drag/resize/lane-out mechanics (captions share the exact same model as
 * zoom keyframes: independently timed, authored against the source
 * recording). Dragging a pill's body moves the whole caption (start/end
 * shift together, duration preserved); dragging an edge trims just that
 * side.
 */
export function CaptionTrack(): JSX.Element | null {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const captionSegments = useCaptionsStore((s) => s.segments);
  const updateSegment = useCaptionsStore((s) => s.updateSegment);

  return (
    <PillTrack
      items={captionSegments}
      segments={segments}
      getStartMs={(caption) => caption.startMs}
      getDurationMs={(caption) => caption.endMs - caption.startMs}
      getTitle={(caption) => `${caption.text} -- drag to move, edges to trim`}
      // Same gradient-fill + dark-border/text + title-row treatment as
      // ZoomTrack (see ZoomTrack.tsx and CutTimeline.tsx's clip segments),
      // in yellow instead of purple so tracks stay visually distinguishable.
      colorClassName="border-yellow-900/40 text-yellow-950"
      handleClassName="bg-black/10 hover:bg-black/25"
      laneHeightPx={CLIP_ROW_HEIGHT_PX}
      renderContent={(caption) => (
        <>
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-yellow-200 via-yellow-400 to-yellow-600" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
          <div className="relative flex flex-col items-center justify-center gap-0.5 leading-none">
            <span className="text-[9px] font-semibold text-yellow-950/70">Caption</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold">
              <MessageSquare size={11} className="shrink-0" />
              <span className="max-w-24 truncate">{caption.text}</span>
            </span>
          </div>
        </>
      )}
      onSelect={(caption) => requestSeek(caption.startMs)}
      onMove={(caption, newStartMs) => {
        const durationMs = caption.endMs - caption.startMs;
        updateSegment(caption.id, { startMs: newStartMs, endMs: newStartMs + durationMs });
      }}
      onResizeStart={(caption, newStartMs) => {
        const startMs = Math.min(newStartMs, caption.endMs - MIN_CAPTION_DURATION_MS);
        updateSegment(caption.id, { startMs });
      }}
      onResizeEnd={(caption, newEndMs) => {
        const endMs = Math.max(newEndMs, caption.startMs + MIN_CAPTION_DURATION_MS);
        updateSegment(caption.id, { endMs });
      }}
    />
  );
}
