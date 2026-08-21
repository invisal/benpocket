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
 * Whether `segments[index]` still touches, contiguously in source-ms, the
 * immediate neighbor(s) `splitAt` created it alongside -- what "Reset trim"
 * merges back together. Both sides of a cut carry `split: true`, but a
 * segment can be adjacent to an unrelated (not from the same cut) segment
 * too, so `split` alone isn't enough -- the contiguity check is what
 * confirms it's really the other half of the same cut.
 */
export function hasMergeableCutBoundary(segments: TimelineSegment[], index: number): boolean {
  const segment = segments[index];
  if (!segment.split) return false;
  const prev = segments[index - 1];
  const next = segments[index + 1];
  const mergesWithPrev = !!prev?.split && prev.range.endMs === segment.range.startMs;
  const mergesWithNext = !!next?.split && segment.range.endMs === next.range.startMs;
  return mergesWithPrev || mergesWithNext;
}

/**
 * The stretch of source footage trimmed off immediately *before* this
 * segment -- the head trim if it's the first clip, otherwise whatever gap
 * ripple-editing closed up between it and the previous kept clip. `0` if
 * nothing was cut there (a plain split leaves no gap). Each pill checks its
 * own left edge for this instead of a separate percent-positioned overlay
 * layer, so its badge is always exactly above the clip it describes -- it
 * can't drift out of alignment the way a standalone layer computed from
 * running totals could.
 */
export function gapBeforeSegmentMs(segments: TimelineSegment[], index: number): number {
  const segment = segments[index];
  const previous = segments[index - 1];
  return previous ? segment.range.startMs - previous.range.endMs : segment.range.startMs;
}

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

// Like `sourceMsToOutputMs`, but a source-ms in a cut-out gap projects
// forward to where the next kept segment begins, instead of returning null.
export function sourceMsToOutputBoundaryMs(
  segments: Seg[],
  totalOutputMs: number,
  sourceMs: number
): number {
  let cursor = 0;
  for (const segment of segments) {
    const { startMs, endMs } = segment.range;
    if (sourceMs < startMs) return cursor;
    if (sourceMs < endMs) return cursor + (sourceMs - startMs) / segment.speed;
    cursor += getSegmentOutputDurationMs(segment);
  }
  return totalOutputMs;
}

/**
 * Shrinks a `[startMs, endMs)` range (a zoom keyframe, annotation, etc.) to
 * the portion still covered by `keptSegments` -- e.g. deleting or trimming
 * the clip under a keyframe's head moves `startMs` forward to where
 * coverage resumes, instead of leaving the range pointing into a cut-out
 * gap (unrenderable, but not actually removed). Returns `null` when nothing
 * in the range is covered anymore.
 *
 * Assumes a single edit carves into one contiguous edge (head and/or tail)
 * rather than splitting the range into disjoint covered pieces -- a
 * deletion landing in the *middle* of the range, leaving both a covered
 * head and a covered tail with a gap between, isn't split into two ranges;
 * it's returned as one spanning both (matching the old all-or-nothing
 * behavior for that rarer case, rather than the complexity of multi-range
 * output).
 */
export function trimRangeToKeptSegments(
  segments: Seg[],
  startMs: number,
  endMs: number
): { startMs: number; endMs: number } | null {
  const covering = segments.filter((s) => s.range.startMs < endMs && s.range.endMs > startMs);
  if (covering.length === 0) return null;
  const coveredStart = Math.max(startMs, Math.min(...covering.map((s) => s.range.startMs)));
  const coveredEnd = Math.min(endMs, Math.max(...covering.map((s) => s.range.endMs)));
  return coveredEnd > coveredStart ? { startMs: coveredStart, endMs: coveredEnd } : null;
}

/**
 * Maps a source-ms `[startMs, endMs)` range (a zoom keyframe's window, a
 * caption's span, etc.) onto the ripple/output timeline as a `{left,
 * width}` percent pair, via `sourceMsToOutputMs` -- so per-tool tracks
 * (ZoomTrack, CaptionTrack, ...) draw pills at their *real* position even
 * once the recording has been cut, instead of only working in the "nothing
 * cut yet" special case.
 *
 * `widthPercent` is the *true* width, not clamped to any minimum visible
 * size -- PillTrack.tsx's `assignLanes` call uses this same value to decide
 * whether two items actually overlap in time, so inflating it here (a
 * pill-track-specific display concern -- a very short item still needs to
 * be wide enough to see/click) would make items that don't really overlap
 * get pushed into separate lanes anyway. PillTrack applies that minimum
 * only to the rendered CSS width, after lanes are already decided.
 *
 * Returns `null` if `startMs` itself falls inside a cut-out gap (the whole
 * thing was cut away).
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
  const outputEnd = sourceMsToOutputBoundaryMs(segments, totalOutputMs, endMs);
  const widthMs = Math.max(0, outputEnd - outputStart);
  return {
    leftPercent: (outputStart / totalOutputMs) * 100,
    widthPercent: (widthMs / totalOutputMs) * 100
  };
}
