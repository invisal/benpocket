import type { JSX } from 'react';
import type { TimelineSegment } from '@screen-studio/types/timeline';

// TODO: render a real waveform - decode the audio track and draw amplitude
// peaks to a canvas, resampled to the current timeline zoom level.
export function AudioWaveform({ segments }: { segments: TimelineSegment[] }): JSX.Element {
  return (
    <div className="h-full w-full opacity-40">{segments.length === 0 ? null : 'waveform'}</div>
  );
}
