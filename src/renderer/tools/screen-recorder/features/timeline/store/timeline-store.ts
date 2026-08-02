import { create } from 'zustand';
import type { ClipSpeed, TimelineSegment, TimelineTrack } from '@screen-recorder/types/timeline';
import type { ExportSegment } from '@screen-recorder/types/export';
import type { EditorTool } from '../../../workspace/editor/editorTools';
import { withHistory } from '../../history/lib/with-history';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { getSegmentOutputDurationMs, trimRangeToKeptSegments } from '../lib/segment-duration';

export const PRIMARY_VIDEO_TRACK_ID = 'video-1';
const MIN_SEGMENT_MS = 200;
export const MIN_TIMELINE_ZOOM = 1;
export const MAX_TIMELINE_ZOOM = 4;
// A recording this long (or shorter) is comfortable to cut at 1x -- zoom
// scales up past that so longer recordings still get enough on-screen
// resolution per clip to trim/split precisely, instead of always cramming
// the whole thing into a fixed-width strip.
const AUTO_ZOOM_REFERENCE_DURATION_MS = 60_000;

/** Default zoom for a freshly-loaded recording -- longer recordings start more zoomed in (and scrollable) rather than always rendering at a fixed 1x regardless of length. Snapped to the same 0.5 steps as the zoom slider. */
function computeAutoZoom(durationMs: number): number {
  const raw = durationMs / AUTO_ZOOM_REFERENCE_DURATION_MS;
  const clamped = Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, raw));
  return Math.round(clamped * 2) / 2;
}

interface TimelineStoreState {
  playheadMs: number;
  /**
   * Mirrors the `<video>` element's actual play state -- lives here (not
   * just EditorPage's local state) so CutTimeline can read it too: the
   * ruler's hover-scrub only live-previews while paused, since while
   * actually playing back, a hovering mouse shouldn't fight the running
   * playback position (see CutTimeline.tsx's `handleRulerPointerMove`).
   */
  isPlaying: boolean;
  /**
   * True for the duration of a ruler/clip hover-scrub session (see
   * CutTimeline.tsx) -- while true, PreviewStage's rAF loop skips syncing
   * `playheadMs` from the video's actual `currentTime`, so the *real*
   * playhead visually stays put while `previewSeek` moves the video/preview
   * around underneath it. Cleared (and `playheadMs` catches up in one
   * `requestSeek`) once the hover is committed (click/release) or cancelled
   * (mouse leaves without clicking).
   */
  isHoverScrubbing: boolean;
  /** Full duration of the underlying recording (segments' ranges are bounded by this). */
  sourceDurationMs: number;
  tracks: TimelineTrack[];
  /**
   * Which clip is selected (drives the Clip tool panel). Lives in the
   * store, not component state, so CutTimeline can be
   * rendered independently of EditorPage -- e.g. as a full-width strip
   * outside the screen-recorder sidebar/content layout -- while still
   * sharing selection with whatever else needs it.
   */
  selectedSegmentId: string | null;
  /** Horizontal scale (1-4x) for the cut timeline. */
  timelineZoom: number;
  /**
   * Which right-hand tool panel is open. Lives here (not EditorPage's local
   * state) for the same reason `selectedSegmentId` does: per-tool tracks
   * (ZoomTrack, ...) render independently of EditorPage and need to be able
   * to open/focus a panel themselves -- e.g. clicking a zoom keyframe pill
   * switches to the Zoom panel so its details are right there to edit.
   */
  activeTool: EditorTool | null;
  /**
   * True while the timeline's cut/blade tool is armed (toggled from the
   * Scissors button in EditorTransportBar). Lives here, not local state, so
   * CutTimeline (rendered independently of EditorPage/EditorTransportBar --
   * see `activeTool` above) can read it too: while armed, hovering the
   * timeline shows a cut-marker preview that follows the cursor instead of
   * just live-scrubbing, and clicking performs the split there instead of
   * selecting/dragging a clip. Stays armed across multiple cuts until
   * toggled off again, matching a typical NLE blade-tool workflow.
   */
  isCutToolActive: boolean;
  /**
   * True while the zoom-placement tool is armed (toggled from the ZoomIn
   * button in EditorTransportBar) -- same shape as `isCutToolActive` above,
   * for the same reason. While armed, CutTimeline shows a ghost preview of
   * a new zoom keyframe in ZoomTrack's own row, following the cursor, and
   * clicking the timeline places the real keyframe there (via
   * `useZoomStore.addKeyframe`) instead of selecting/dragging a clip.
   */
  isZoomToolActive: boolean;
  /**
   * One-shot seek command (source ms), separate from `playheadMs` to avoid a
   * feedback loop: CutTimeline (rendered independently of the `<video>`
   * element) can't imperatively set `videoRef.current.currentTime` itself,
   * so it posts a request here; EditorPage's effect applies it to the video
   * and clears it, while `playheadMs` keeps reflecting actual playback
   * position from the video's own `timeupdate`.
   */
  seekRequestMs: number | null;
  /**
   * One-shot flag set by project-load hydration (see
   * features/project/lib/apply-project-snapshot.ts) so EditorPage's "a
   * different recording loaded" effect skips clobbering the just-restored
   * `tracks` with a fresh single full-duration segment. Cleared as soon as
   * that effect consumes it.
   */
  skipNextAutoInit: boolean;
  /**
   * Bumped only when `setPlayhead` is called with `isJump: true` -- i.e. a
   * playback-driven discontinuous jump across a cut boundary, as opposed to
   * a continuous 60fps playback tick or a manual scrub/seek. `Playhead.tsx`
   * watches this to know when to glide to the new position instead of
   * snapping instantly.
   */
  playheadJumpToken: number;
  setPlayhead: (ms: number, isJump?: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsHoverScrubbing: (isHoverScrubbing: boolean) => void;
  setTracks: (tracks: TimelineTrack[]) => void;
  setSelectedSegmentId: (segmentId: string | null) => void;
  setTimelineZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorTool | null) => void;
  setCutToolActive: (active: boolean) => void;
  setZoomToolActive: (active: boolean) => void;
  requestSeek: (ms: number) => void;
  /**
   * Like `requestSeek`, but leaves `playheadMs` alone -- moves the actual
   * `<video>` (so the preview shows that frame) without visually moving the
   * main playhead, for hover-scrub's "gray marker follows the cursor, blue
   * playhead doesn't" behavior (see CutTimeline.tsx). Only makes sense
   * combined with `isHoverScrubbing: true`, otherwise PreviewStage's rAF
   * loop will sync `playheadMs` from the video on the very next frame anyway.
   */
  previewSeek: (ms: number) => void;
  clearSeekRequest: () => void;
  initializeFromDuration: (durationMs: number) => void;
  /** Splits whichever kept segment covers `atOutputMs` (in the ripple/output timeline) into two. */
  splitAt: (atOutputMs: number) => void;
  /** Ripple-removes a segment; no-ops if it's the last one (nothing to export). */
  deleteSegment: (segmentId: string) => void;
  reorderSegments: (fromIndex: number, toIndex: number) => void;
  resizeSegmentEdge: (segmentId: string, edge: 'start' | 'end', newSourceMs: number) => void;
  /** Restores a segment's range back to `originalRange` and clears `trimmed`. */
  resetSegmentTrim: (segmentId: string) => void;
  /** Speed is per-clip: each segment can play back at a different rate. */
  setSegmentSpeed: (segmentId: string, speed: ClipSpeed) => void;
  /** Cursor visibility is per-clip: independent of the global `CursorSettings.visible` toggle. */
  setSegmentCursorHidden: (segmentId: string, cursorHidden: boolean) => void;
  /** Webcam PiP visibility is per-clip: independent of the global `WebcamOptions.enabled` toggle. */
  setSegmentWebcamHidden: (segmentId: string, webcamHidden: boolean) => void;
  /** Audio mute is per-clip -- there's no separate global mute toggle. */
  setSegmentAudioMuted: (segmentId: string, audioMuted: boolean) => void;
  /** Kept clips (range + speed + cursor/webcam visibility + audio mute) in output order -- this is exactly ExportOptions.segments. */
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

// Must run before the caller's own `set()`, not after -- otherwise the
// gesture's recorded "before" snapshot is taken mid-cut instead of pre-cut.
// Shrinks each keyframe to whatever portion of it is still covered by
// `keptSegments` (e.g. a deletion/trim that only ate its head moves `atMs`
// forward rather than leaving it pointing at a cut-out gap), and only drops
// it outright once nothing of it is covered anymore.
function reconcileZoomKeyframesWithSegments(keptSegments: TimelineSegment[]): void {
  const { keyframes, removeKeyframe, updateKeyframe } = useZoomStore.getState();
  for (const kf of keyframes) {
    const covered = trimRangeToKeptSegments(keptSegments, kf.atMs, kf.atMs + kf.durationMs);
    if (!covered) {
      removeKeyframe(kf.id);
    } else if (covered.startMs !== kf.atMs || covered.endMs - covered.startMs !== kf.durationMs) {
      updateKeyframe(kf.id, {
        atMs: covered.startMs,
        durationMs: covered.endMs - covered.startMs
      });
    }
  }
}

export const useTimelineStore = create<TimelineStoreState>(
  withHistory(
    'timeline',
    (s) => ({ tracks: s.tracks }),
    (set, get) => ({
      playheadMs: 0,
      playheadJumpToken: 0,
      isPlaying: false,
      isHoverScrubbing: false,
      sourceDurationMs: 0,
      tracks: [
        { id: PRIMARY_VIDEO_TRACK_ID, kind: 'video', segments: [] },
        { id: 'webcam-1', kind: 'webcam', segments: [] },
        { id: 'audio-1', kind: 'audio', segments: [] },
        { id: 'annotation-1', kind: 'annotation', segments: [] }
      ],
      selectedSegmentId: null,
      timelineZoom: 1,
      activeTool: 'background',
      isCutToolActive: false,
      isZoomToolActive: false,
      seekRequestMs: null,
      skipNextAutoInit: false,
      setPlayhead: (playheadMs, isJump) =>
        set((state) => ({
          playheadMs,
          playheadJumpToken: isJump ? state.playheadJumpToken + 1 : state.playheadJumpToken
        })),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setIsHoverScrubbing: (isHoverScrubbing) => set({ isHoverScrubbing }),
      setTracks: (tracks) => set({ tracks }),
      setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),
      setTimelineZoom: (timelineZoom) => set({ timelineZoom }),
      setActiveTool: (activeTool) => set({ activeTool }),
      // Cut and zoom tools are mutually exclusive -- arming one disarms the
      // other, so only one "click the timeline to do X" mode is ever live
      // at once. Deactivating one leaves the other's state alone (it
      // should already be false under this same invariant).
      setCutToolActive: (isCutToolActive) =>
        set((state) => ({
          isCutToolActive,
          isZoomToolActive: isCutToolActive ? false : state.isZoomToolActive
        })),
      setZoomToolActive: (isZoomToolActive) =>
        set((state) => ({
          isZoomToolActive,
          isCutToolActive: isZoomToolActive ? false : state.isCutToolActive
        })),
      requestSeek: (ms) => set({ seekRequestMs: ms, playheadMs: ms }),
      previewSeek: (ms) => set({ seekRequestMs: ms }),
      clearSeekRequest: () => set({ seekRequestMs: null }),

      initializeFromDuration: (durationMs) => {
        const track = primaryTrack(get().tracks);
        const segment: TimelineSegment = {
          id: crypto.randomUUID(),
          trackId: PRIMARY_VIDEO_TRACK_ID,
          range: { startMs: 0, endMs: durationMs },
          originalRange: { startMs: 0, endMs: durationMs },
          speed: 1,
          sourceOffsetMs: 0,
          trimmed: false,
          split: false,
          cursorHidden: false,
          webcamHidden: false,
          audioMuted: false
        };
        set({
          sourceDurationMs: durationMs,
          timelineZoom: computeAutoZoom(durationMs),
          tracks: replaceTrack(get().tracks, { ...track, segments: [segment] })
        });
      },

      splitAt: (atOutputMs) => {
        const track = primaryTrack(get().tracks);
        let cursor = 0;
        const nextSegments: TimelineSegment[] = [];

        for (const segment of track.segments) {
          const outputDuration = getSegmentOutputDurationMs(segment);
          const withinSegment = atOutputMs >= cursor && atOutputMs < cursor + outputDuration;
          if (!withinSegment) {
            nextSegments.push(segment);
            cursor += outputDuration;
            continue;
          }

          const splitSourceMs = segment.range.startMs + (atOutputMs - cursor) * segment.speed;
          const leftDuration = splitSourceMs - segment.range.startMs;
          const rightDuration = segment.range.endMs - splitSourceMs;
          if (leftDuration < MIN_SEGMENT_MS || rightDuration < MIN_SEGMENT_MS) {
            // Too close to an edge to make two meaningful clips -- leave it whole.
            nextSegments.push(segment);
          } else {
            nextSegments.push(
              {
                ...segment,
                range: { startMs: segment.range.startMs, endMs: splitSourceMs },
                originalRange: { startMs: segment.range.startMs, endMs: splitSourceMs },
                split: true
              },
              {
                ...segment,
                id: crypto.randomUUID(),
                range: { startMs: splitSourceMs, endMs: segment.range.endMs },
                originalRange: { startMs: splitSourceMs, endMs: segment.range.endMs },
                split: true
              }
            );
          }
          cursor += outputDuration;
        }

        set({ tracks: replaceTrack(get().tracks, { ...track, segments: nextSegments }) });
      },

      deleteSegment: (segmentId) => {
        const track = primaryTrack(get().tracks);
        if (track.segments.length <= 1) return;
        const segments = track.segments.filter((s) => s.id !== segmentId);
        beginGesture();
        reconcileZoomKeyframesWithSegments(segments);
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
        endGesture();
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
            return {
              ...segment,
              range: { ...segment.range, startMs: Math.max(0, startMs) },
              trimmed: true
            };
          }
          const endMs = Math.max(clamped, segment.range.startMs + MIN_SEGMENT_MS);
          return {
            ...segment,
            range: { ...segment.range, endMs: Math.min(sourceDurationMs, endMs) },
            trimmed: true
          };
        });
        reconcileZoomKeyframesWithSegments(segments);
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
      },

      resetSegmentTrim: (segmentId) => {
        const track = primaryTrack(get().tracks);
        const segments = track.segments;
        const index = segments.findIndex((s) => s.id === segmentId);
        if (index === -1) return;

        const segment = segments[index];
        const prev = segments[index - 1];
        const next = segments[index + 1];
        const mergesWithPrev =
          segment.split && !!prev?.split && prev.range.endMs === segment.range.startMs;
        const mergesWithNext =
          segment.split && !!next?.split && segment.range.endMs === next.range.startMs;

        // A cut's two halves are each other's only real "trim" to undo --
        // merge whichever neighbor(s) still share that cut boundary back
        // into one un-cut segment, rather than restoring `range` in place
        // (there's nothing to restore to: a split segment's own range *is*
        // its originalRange, see `splitAt`).
        if (mergesWithPrev || mergesWithNext) {
          const start = mergesWithPrev ? index - 1 : index;
          const end = mergesWithNext ? index + 1 : index;
          const first = segments[start];
          const last = segments[end];
          const merged: TimelineSegment = {
            ...first,
            range: { startMs: first.range.startMs, endMs: last.range.endMs },
            originalRange: { startMs: first.range.startMs, endMs: last.range.endMs },
            trimmed: false,
            split: false
          };
          const nextSegments = [...segments.slice(0, start), merged, ...segments.slice(end + 1)];
          set({ tracks: replaceTrack(get().tracks, { ...track, segments: nextSegments }) });
          return;
        }

        if (!segment.trimmed) return;
        const nextSegments = segments.map((s) =>
          s.id === segmentId ? { ...s, range: s.originalRange, trimmed: false } : s
        );
        set({ tracks: replaceTrack(get().tracks, { ...track, segments: nextSegments }) });
      },

      setSegmentSpeed: (segmentId, speed) => {
        const track = primaryTrack(get().tracks);
        const segments = track.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, speed } : segment
        );
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
      },

      setSegmentCursorHidden: (segmentId, cursorHidden) => {
        const track = primaryTrack(get().tracks);
        const segments = track.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, cursorHidden } : segment
        );
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
      },

      setSegmentWebcamHidden: (segmentId, webcamHidden) => {
        const track = primaryTrack(get().tracks);
        const segments = track.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, webcamHidden } : segment
        );
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
      },

      setSegmentAudioMuted: (segmentId, audioMuted) => {
        const track = primaryTrack(get().tracks);
        const segments = track.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, audioMuted } : segment
        );
        set({ tracks: replaceTrack(get().tracks, { ...track, segments }) });
      },

      getExportSegments: () =>
        primaryTrack(get().tracks).segments.map((s) => ({
          range: s.range,
          speed: s.speed,
          cursorHidden: s.cursorHidden,
          webcamHidden: s.webcamHidden,
          audioMuted: s.audioMuted
        })),

      getOutputDurationMs: () =>
        primaryTrack(get().tracks).segments.reduce(
          (sum, s) => sum + getSegmentOutputDurationMs(s),
          0
        )
    })
  )
);
