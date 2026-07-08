import type { JSX } from 'react';
import { ZoomIn } from 'lucide-react';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { useZoomStore } from '../store/zoom-store';

/**
 * Compact visual companion to `ZoomKeyframeEditor` (the real editing
 * surface, in the right-hand tool panel) -- shows what zoom keyframes exist
 * underneath the cut timeline, the way the reference design's purple "Zoom"
 * track does.
 *
 * Keyframe `atMs` is authored against the *source* recording's raw
 * timeline (see ZoomKeyframeEditor's `currentTimeMs`), the same convention
 * annotations already use elsewhere in this codebase. That only lines up
 * with the *kept/output* timeline `CutTimeline` draws when nothing's been
 * cut yet -- so proportional markers are only drawn in that common "one
 * segment, untrimmed" case; once the recording has been split/trimmed, this
 * just shows a count instead of a (potentially misleading) mis-scaled bar.
 */
export function ZoomTrack(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  const keyframes = useZoomStore((s) => s.keyframes);

  const isUncut =
    segments.length === 1 &&
    segments[0].range.startMs === 0 &&
    segments[0].range.endMs === sourceDurationMs;

  return (
    <div className="flex h-8 items-center gap-2 rounded-md bg-violet-500/10 px-2.5">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-violet-300">
        <ZoomIn size={11} /> Zoom
      </span>

      {keyframes.length === 0 && (
        <span className="text-[11px] text-white/30">No keyframes yet</span>
      )}

      {keyframes.length > 0 && isUncut && sourceDurationMs > 0 && (
        <div className="relative h-4 flex-1 overflow-hidden rounded bg-violet-500/10">
          {keyframes.map((kf) => (
            <div
              key={kf.id}
              title={`${kf.depth.toFixed(1)}x at ${(kf.atMs / 1000).toFixed(1)}s`}
              className="absolute top-0 h-full rounded bg-violet-400/70"
              style={{
                left: `${(kf.atMs / sourceDurationMs) * 100}%`,
                width: `${Math.max(1.5, (kf.durationMs / sourceDurationMs) * 100)}%`
              }}
            />
          ))}
        </div>
      )}

      {keyframes.length > 0 && !isUncut && (
        <span className="text-[11px] text-white/30">
          {keyframes.length} keyframe{keyframes.length === 1 ? '' : 's'} -- edit in the Zoom panel
        </span>
      )}
    </div>
  );
}
