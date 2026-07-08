import type { JSX } from 'react';
import type { TimelineTrack as TimelineTrackType } from '@screen-studio/types/timeline';
import { AudioWaveform } from './AudioWaveform';

// TODO: render TimelineSegment blocks with trim handles and a per-segment
// speed badge (0.5x/1x/1.25x/1.5x/2x); support drag-to-reorder within a track.
export function TimelineTrack({ track }: { track: TimelineTrackType }): JSX.Element {
  return (
    <div className="flex h-10 items-center gap-1 rounded bg-black/30 px-2">
      <span className="w-16 shrink-0 text-[10px] uppercase text-white/40">{track.kind}</span>
      <div className="relative flex-1">
        {track.kind === 'audio' && <AudioWaveform segments={track.segments} />}
      </div>
    </div>
  );
}
