import type { JSX } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
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
      colorClassName="border-yellow-600/50 bg-yellow-700/30 text-yellow-100 hover:bg-yellow-700/45"
      renderContent={(caption) => (
        <>
          <MessageSquare size={10} className="shrink-0" />
          <span className="truncate text-[10px] font-medium">{caption.text}</span>
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
