import { create } from 'zustand';
import type { CropRect, TimelineSegment, TimelineTrack } from '@screen-studio/types/timeline';
import type { ExportSegment } from '@screen-studio/types/export';

export const PRIMARY_VIDEO_TRACK_ID = 'video-1';
const MIN_SEGMENT_MS = 200;

interface TimelineStoreState {
  playheadMs: number;
  /** Full duration of the underlying recording (segments' ranges are bounded by this). */
  sourceDurationMs: number;
  tracks: TimelineTrack[];
  setPlayhead: (ms: number) => void;
  setTracks: (tracks: TimelineTrack[]) => void;
  /** Resets the primary video track to one segment spanning the whole recording. */
  initializeFromDuration: (durationMs: number) => void;
  /** Splits whichever kept segment covers `atOutputMs` (in the ripple/output timeline) into two. */
  splitAt: (atOutputMs: number) => void;
  /** Ripple-removes a segment; no-ops if it's the last one (nothing to export). */
  deleteSegment: (segmentId: string) => void;
  reorderSegments: (fromIndex: number, toIndex: number) => void;
  /** Adjusts one edge of a segment's own source in/out point. */
  resizeSegmentEdge: (segmentId: string, edge: 'start' | 'end', newSourceMs: number) => void;
  /** Crop is per-clip: each segment can be framed differently. */
  setSegmentCrop: (segmentId: string, crop: CropRect | null) => void;
  /** Kept clips (range + crop) in output order -- this is exactly ExportOptions.segments. */
  getExportSegments: () => ExportSegment[];
  getOutputDurationMs: () => number;
}

function primaryTrack(tracks: TimelineTrack[]): TimelineTrack {
  const track = tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID);
  if (!track) throw new Error(`Primary video track "${PRIMARY_VIDEO_TRACK_ID}" is missing`);
  return track;
}

function replaceTrack(tracks: TimelineTrack[], updated: TimelineTrack): TimelineTrack[] {
  return tracks.map((t) => (t.id === updated.id ? updated : t));
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => ({
  playheadMs: 0,
  sourceDurationMs: 0,
  tracks: [
    { id: PRIMARY_VIDEO_TRACK_ID, kind: 'video', segments: [] },
    { id: 'webcam-1', kind: 'webcam', segments: [] },
    { id: 'audio-1', kind: 'audio', segments: [] },
    { id: 'annotation-1', kind: 'annotation', segments: [] }
  ],
  setPlayhead: (playheadMs) => set({ playheadMs }),
  setTracks: (tracks) => set({ tracks }),

  initializeFromDuration: (durationMs) => {
    const track = primaryTrack(get().tracks);
    const segment: TimelineSegment = {
      id: crypto.randomUUID(),
      trackId: PRIMARY_VIDEO_TRACK_ID,
      range: { startMs: 0, endMs: durationMs },
      speed: 1,
      sourceOffsetMs: 0,
      crop: null
    };
    set({
      sourceDurationMs: durationMs,
      tracks: replaceTrack(get().tracks, { ...track, segments: [segment] })
    });
  },

  splitAt: (atOutputMs) => {
    const track = primaryTrack(get().tracks);
    let cursor = 0;
    const nextSegments: TimelineSegment[] = [];

    for (const segment of track.segments) {
      const duration = segment.range.endMs - segment.range.startMs;
      const withinSegment = atOutputMs >= cursor && atOutputMs < cursor + duration;
      if (!withinSegment) {
        nextSegments.push(segment);
        cursor += duration;
        continue;
      }

      const splitSourceMs = segment.range.startMs + (atOutputMs - cursor);
      const leftDuration = splitSourceMs - segment.range.startMs;
      const rightDuration = segment.range.endMs - splitSourceMs;
      if (leftDuration < MIN_SEGMENT_MS || rightDuration < MIN_SEGMENT_MS) {
        // Too close to an edge to make two meaningful clips -- leave it whole.
        nextSegments.push(segment);
      } else {
        nextSegments.push(
          { ...segment, range: { startMs: segment.range.startMs, endMs: splitSourceMs } },
          {
            ...segment,
            id: crypto.randomUUID(),
            range: { startMs: splitSourceMs, endMs: segment.range.endMs }
          }
        );
      }
      cursor += duration;
    }

    set({ tracks: replaceTrack(get().tracks, { ...track, segments: nextSegments }) });
  },

  deleteSegment: (segmentId) => {
    const track = primaryTrack(get().tracks);
    if (track.segments.length <= 1) return;
    set({
      tracks: replaceTrack(get().tracks, {
        ...track,
        segments: track.segments.filter((s) => s.id !== segmentId)
      })
    });
  },

  reorderSegments: (fromIndex, toIndex) => {
    const track = primaryTrack(get().tracks);
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= track.segments.length ||
      toIndex >= track.segments.length
    ) {
      return;
    }
    const segments = [...track.segments];
    const [moved] = segments.splice(fromIndex, 1);
    segments.splice(toIndex, 0, moved);
    set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
  },

  resizeSegmentEdge: (segmentId, edge, newSourceMs) => {
    const track = primaryTrack(get().tracks);
    const { sourceDurationMs } = get();
    const segments = track.segments.map((segment) => {
      if (segment.id !== segmentId) return segment;
      const clamped = Math.min(Math.max(newSourceMs, 0), sourceDurationMs);
      if (edge === 'start') {
        const startMs = Math.min(clamped, segment.range.endMs - MIN_SEGMENT_MS);
        return { ...segment, range: { ...segment.range, startMs: Math.max(0, startMs) } };
      }
      const endMs = Math.max(clamped, segment.range.startMs + MIN_SEGMENT_MS);
      return { ...segment, range: { ...segment.range, endMs: Math.min(sourceDurationMs, endMs) } };
    });
    set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
  },

  setSegmentCrop: (segmentId, crop) => {
    const track = primaryTrack(get().tracks);
    const segments = track.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, crop } : segment
    );
    set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
  },

  getExportSegments: () =>
    primaryTrack(get().tracks).segments.map((s) => ({ range: s.range, crop: s.crop })),

  getOutputDurationMs: () =>
    primaryTrack(get().tracks).segments.reduce(
      (sum, s) => sum + (s.range.endMs - s.range.startMs),
      0
    )
}));
