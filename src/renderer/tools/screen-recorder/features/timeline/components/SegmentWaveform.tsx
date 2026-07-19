import type { JSX } from 'react';
import { useMemo } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';

interface SegmentWaveformProps {
  segment: Pick<TimelineSegment, 'range'>;
  peaks: Float32Array;
  /** Full source recording length -- `peaks` is sampled uniformly across this, so it's what maps `segment.range` (source ms) to a slice of `peaks`. */
  sourceDurationMs: number;
}

const VIEW_HEIGHT = 100;
/** Never fully flat even during silence -- a real waveform's "quiet" stretches still show a thin ripple, and a dead-flat line reads as broken/loading rather than quiet. */
const MIN_AMPLITUDE = 0.04;
/** Leaves a hairline margin off the very top edge instead of the loudest peak touching the clip's border. */
const AMPLITUDE_SCALE = 0.92;
/** Flat multiplier on the raw peak value -- same shape as the unboosted waveform, just taller, since raw mic samples rarely approach the theoretical 0-1 range. Clamped to 1 below so a genuinely loud peak still can't draw past the clip's top edge. */
const AMPLITUDE_BOOST = 4;

/**
 * This clip's slice of the recording's waveform, anchored to the bottom
 * edge (not mirrored top/bottom) and stretched to fill the clip via
 * `preserveAspectRatio="none"` -- so it re-flows automatically as the clip
 * is trimmed, resized, or zoomed without recomputing points, the same way
 * the gradient behind it does.
 */
export function SegmentWaveform({
  segment,
  peaks,
  sourceDurationMs
}: SegmentWaveformProps): JSX.Element | null {
  const slice = useMemo(() => {
    if (sourceDurationMs <= 0) return null;
    const startIdx = Math.floor((segment.range.startMs / sourceDurationMs) * peaks.length);
    const endIdx = Math.ceil((segment.range.endMs / sourceDurationMs) * peaks.length);
    const clampedStart = Math.max(0, Math.min(peaks.length - 1, startIdx));
    const clampedEnd = Math.max(clampedStart + 1, Math.min(peaks.length, endIdx));
    return peaks.subarray(clampedStart, clampedEnd);
  }, [peaks, sourceDurationMs, segment.range.startMs, segment.range.endMs]);

  if (!slice || slice.length === 0) return null;

  const topPoints: string[] = [];
  for (let i = 0; i < slice.length; i++) {
    const boosted = Math.min(1, Math.max(slice[i], MIN_AMPLITUDE) * AMPLITUDE_BOOST);
    const amplitude = boosted * VIEW_HEIGHT * AMPLITUDE_SCALE;
    topPoints.push(`${i},${VIEW_HEIGHT - amplitude}`);
  }
  const lastIndex = slice.length - 1;
  const path = `M 0,${VIEW_HEIGHT} L ${topPoints.join(' L ')} L ${lastIndex},${VIEW_HEIGHT} Z`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${slice.length - 1} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} fill="rgba(255, 255, 255, 0.32)" />
    </svg>
  );
}
