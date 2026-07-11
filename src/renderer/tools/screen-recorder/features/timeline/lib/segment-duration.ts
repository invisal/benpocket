import type { TimelineSegment } from '@screen-recorder/types/timeline';

/**
 * A clip's actual playback length once its speed is applied -- e.g. a 4s
 * source range at 2x speed plays back in 2s. `range` itself always stays in
 * source-ms coordinates (see timeline-store.ts), so anywhere the UI needs to
 * reason about output-timeline length/position must go through this instead
 * of `range.endMs - range.startMs`.
 */
export function getSegmentOutputDurationMs(
  segment: Pick<TimelineSegment, 'range' | 'speed'>
): number {
  return (segment.range.endMs - segment.range.startMs) / segment.speed;
}

type Seg = Pick<TimelineSegment, 'range' | 'speed'>;

/**
 * Maps a source-ms position (e.g. the playing `<video>`'s `currentTime`)
 * to its position on the ripple/output timeline `CutTimeline` draws, or
 * `null` if it falls inside a cut-out gap (no kept segment covers it).
 */
export function sourceMsToOutputMs(segments: Seg[], sourceMs: number): number | null {
  let cursor = 0;
  for (const segment of segments) {
    const { startMs, endMs } = segment.range;
    if (sourceMs >= startMs && sourceMs < endMs) {
      return cursor + (sourceMs - startMs) / segment.speed;
    }
    cursor += getSegmentOutputDurationMs(segment);
  }
  return null;
}

/**
 * Inverse of `sourceMsToOutputMs` -- given a position on the ripple/output
 * timeline (e.g. where the user clicked/dragged in CutTimeline), returns
 * the corresponding source-ms position to seek the `<video>` element to.
 * Clamps out-of-range input to the nearest end; `null` only when there are
 * no segments at all.
 */
export function outputMsToSourceMs(segments: Seg[], outputMs: number): number | null {
  if (segments.length === 0) return null;
  let cursor = 0;
  for (const segment of segments) {
    const outputDuration = getSegmentOutputDurationMs(segment);
    if (outputMs < cursor + outputDuration || segment === segments[segments.length - 1]) {
      const clampedOutputMs = Math.min(Math.max(0, outputMs - cursor), outputDuration);
      return segment.range.startMs + clampedOutputMs * segment.speed;
    }
    cursor += outputDuration;
  }
  return null;
}

/**
 * Maps a source-ms `[startMs, endMs)` range (a zoom keyframe's window, a
 * caption's span, etc.) onto the ripple/output timeline as a `{left,
 * width}` percent pair, via `sourceMsToOutputMs` -- so per-tool tracks
 * (ZoomTrack, CaptionTrack, ...) draw pills at their *real* position even
 * once the recording has been cut, instead of only working in the "nothing
 * cut yet" special case.
 *
 * Returns `null` if `startMs` itself falls inside a cut-out gap (the whole
 * thing was cut away). If only the tail was cut, the end clamps to the full
 * output duration rather than disappearing.
 */
export function sourceRangeToOutputPercent(
  segments: Seg[],
  totalOutputMs: number,
  startMs: number,
  endMs: number
): { leftPercent: number; widthPercent: number } | null {
  if (totalOutputMs <= 0) return null;
  const outputStart = sourceMsToOutputMs(segments, startMs);
  if (outputStart === null) return null;
  const outputEnd = sourceMsToOutputMs(segments, endMs) ?? totalOutputMs;
  const widthMs = Math.max(0, outputEnd - outputStart);
  return {
    leftPercent: (outputStart / totalOutputMs) * 100,
    widthPercent: Math.max(1.5, (widthMs / totalOutputMs) * 100)
  };
}
