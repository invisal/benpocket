import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Clapperboard,
  Eye,
  EyeOff,
  Gauge,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  ZoomIn
} from 'lucide-react';
import {
  CLIP_SPEED_OPTIONS,
  AUDIO_VOLUME_OPTIONS,
  type TimelineSegment
} from '@screen-recorder/types/timeline';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useScreenRecorderStore, EMPTY_CURSOR_PATH } from '../../../store/screen-recorder-store';
import { selectClipSegment, selectZoomKeyframe } from '../../../store/selection-coordinator';
import { useHistoryStore } from '../../history/store/history-store';
import { useTimelineStore, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM } from '../store/timeline-store';
import { useWaveformStore } from '../store/waveform-store';
import {
  getSegmentOutputDurationMs,
  hasMergeableCutBoundary,
  outputMsToSourceMs
} from '../lib/segment-duration';
import { CLIP_ROW_HEIGHT_PX, TIMELINE_SCROLL_PADDING_PX } from '../lib/assign-lanes';
import { useEdgeResize } from '../lib/use-edge-resize';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { useZoomStore, findKeyframeContaining } from '../../zoom/store/zoom-store';
import { resolveFixedPosition } from '../../zoom/lib/resolve-fixed-position';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { ZoomTrack } from '../../zoom/components/ZoomTrack';
import { CaptionTrack } from '../../captions/components/CaptionTrack';
import { AnnotationTrack } from '../../annotations/components/AnnotationTrack';
import { BlurMaskTrack } from '../../blur-mask/components/BlurMaskTrack';
import { Playhead } from './Playhead';
import { SegmentWaveform } from './SegmentWaveform';
import { cn } from '../../../lib/utils';
import { Slider } from '../../../components/ui/slider';
import { isLikelyLinux } from '../../../lib/platform';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Short "Ns" / "N.Ns" duration label for clip pills and cut-marker badges --
 * distinct from `formatTime`'s "m:ss" (the ruler/transport readout), matching
 * how a few-second clip is normally talked about ("22s", "0.9s") rather than
 * as minutes.
 */
function formatShortDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 1) return `${totalSeconds.toFixed(1)}s`;
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  return formatTime(ms);
}

// "Nice" tick spacings to choose from so the ruler never gets cluttered
// regardless of recording length or zoom.
const NICE_TICK_INTERVALS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
const TARGET_MAJOR_TICK_COUNT = 8;

function pickMajorTickIntervalMs(totalDurationMs: number): number {
  const totalSec = totalDurationMs / 1000;
  const interval =
    NICE_TICK_INTERVALS_SEC.find((sec) => totalSec / sec <= TARGET_MAJOR_TICK_COUNT) ??
    NICE_TICK_INTERVALS_SEC[NICE_TICK_INTERVALS_SEC.length - 1];
  return interval * 1000;
}

// Sized to comfortably fit the ruler+clip row plus the Zoom/Caption/Speed/Crop
// pill tracks beneath it without squishing (each track is a fixed h-9, `shrink-0`).
const MIN_PANEL_HEIGHT_PX = 210;
// Also caps how far the auto-grow effect below will stretch the panel --
// a pathological number of overlapping pills still can't squeeze the
// preview stage down to nothing (see ScreenRecorderApp.tsx's layout: this
// panel's height is taken directly out of the preview area's).
const MAX_PANEL_HEIGHT_PX = 300;
// The content wrapper's own `py-3` padding (24px) plus its `gap-2` (8px)
// between the toolbar row and the scrollable track area -- the only part of
// the panel's required height that isn't covered by measuring
// `toolbarRowRef`/`trackAreaRef` directly (see the auto-grow effect below).
const PANEL_CONTENT_CHROME_PX = 24 + 10;

// Taller than a plain pill track (`CLIP_ROW_HEIGHT_PX`) -- clips carry a
// two-line label (name + duration/speed), not just a single corner badge.
const CLIP_PILL_HEIGHT_PX = CLIP_ROW_HEIGHT_PX * 1.4;
// Adjacent clip pills sit flush edge-to-edge (no visual gap) -- the only
// separation between them is the `ring` drawn on the selected/drag-over
// pill (a box-shadow, so it doesn't need layout space of its own). Kept as
// an explicit 0 (rather than dropping the left/width math below) so the
// percentages stay computed the same way regardless of clip count, in case
// a gap is ever reintroduced.
const CLIP_GAP_PX = 0;
// Space reserved above the clip row for the floating pin-shaped cut
// markers, whose tip touches the row's top edge.
const CUT_MARKER_RESERVED_PX = 10;
// Below this, a head/tail trim or closed-up gap between clips is treated as
// float noise, not a real cut worth flagging with a badge.
const MIN_CUT_MARKER_GAP_MS = 100;

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
function gapBeforeSegmentMs(segments: TimelineSegment[], index: number): number {
  const segment = segments[index];
  const previous = segments[index - 1];
  return previous ? segment.range.startMs - previous.range.endMs : segment.range.startMs;
}

/**
 * Map-pin-shaped scissors badge -- a single teardrop (a rounded square with
 * one sharp corner, rotated so that corner points straight down) whose tip
 * touches the exact cut point, with the scissors icon and duration stacked
 * inside its round head. `anchorClassName` supplies both the horizontal
 * anchor edge (`left-0` / `right-0`) and the matching outward half-width
 * translate (`-translate-x-1/2` / `translate-x-1/2`) that recenters the pin
 * on that edge, so the tip always lands exactly on the cut regardless of
 * which side it's anchored from, rather than merely flush against it.
 */
function CutMarker({
  durationMs,
  anchorClassName
}: {
  /** Omitted for the cut tool's live preview pin, which follows the cursor before any cut has actually been made -- there's no trimmed duration to show yet. */
  durationMs?: number;
  anchorClassName: string;
}): JSX.Element {
  return (
    <div className={cn('pointer-events-none absolute -top-10 z-10', anchorClassName)}>
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 -rotate-45 rounded-[50%_50%_50%_0] border-2 border-accent bg-surface-3 shadow-sm" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-px pt-0.5">
          <Scissors size={12} className="text-foreground" />
          {durationMs !== undefined && (
            <span className="whitespace-nowrap text-[9px] font-medium leading-none text-foreground">
              {formatShortDuration(durationMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The primary cut/trim editor: kept segments are packed edge-to-edge in
 * output order (not laid out at their original source position), so
 * removing the middle of a recording visibly closes the gap -- "ripple"
 * editing, same idea as any NLE timeline.
 *
 * Takes no props -- selection and zoom live in the timeline store (not
 * component state) so this can be rendered independently of EditorPage,
 * e.g. as a full-width strip in ScreenRecorderApp that isn't nested under
 * (and therefore isn't squeezed by) the screen-recorder tool's sidebar.
 */
export function CutTimeline(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === 'video-1')?.segments ?? []
  );
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const zoom = useTimelineStore((s) => s.timelineZoom);
  const setTimelineZoom = useTimelineStore((s) => s.setTimelineZoom);
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const previewSeek = useTimelineStore((s) => s.previewSeek);
  const setIsHoverScrubbing = useTimelineStore((s) => s.setIsHoverScrubbing);
  const splitAt = useTimelineStore((s) => s.splitAt);
  const deleteSegment = useTimelineStore((s) => s.deleteSegment);
  const resetSegmentTrim = useTimelineStore((s) => s.resetSegmentTrim);
  const setSegmentSpeed = useTimelineStore((s) => s.setSegmentSpeed);
  const setSegmentCursorHidden = useTimelineStore((s) => s.setSegmentCursorHidden);
  const setSegmentWebcamHidden = useTimelineStore((s) => s.setSegmentWebcamHidden);
  const resizeSegmentEdge = useTimelineStore((s) => s.resizeSegmentEdge);
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  // Gates the ruler's hover-scrub below -- only toggles on play/pause (not a
  // 60fps concern like `playheadMs`), so subscribing directly here is fine.
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  // Armed from the Scissors button in EditorTransportBar -- while true, a
  // click anywhere on the timeline (ruler or clip row) performs a split at
  // the cursor instead of seeking/selecting, and the hover marker below
  // renders as a live cut-preview pin instead of the plain gray scrub line.
  const isCutToolActive = useTimelineStore((s) => s.isCutToolActive);
  const setCutToolActive = useTimelineStore((s) => s.setCutToolActive);
  // Armed from the ZoomIn button -- same idea, but a click adds a zoom
  // keyframe at the cursor instead of splitting; ZoomTrack (rendered below)
  // gets the hovered position as a prop and draws its own ghost preview.
  const isZoomToolActive = useTimelineStore((s) => s.isZoomToolActive);
  const setZoomToolActive = useTimelineStore((s) => s.setZoomToolActive);
  const setSegmentAudioMuted = useTimelineStore((s) => s.setSegmentAudioMuted);
  const setSegmentAudioVolume = useTimelineStore((s) => s.setSegmentAudioVolume);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const addZoomKeyframe = useZoomStore((s) => s.addKeyframe);
  const updateZoomKeyframe = useZoomStore((s) => s.updateKeyframe);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  // Any "arm a tool, then click the timeline" mode currently active -- both
  // suppress the clip row's normal select/drag/resize/double-click-to-split
  // interactions the same way, so their guards share this one flag.
  const isPointerToolActive = isCutToolActive || isZoomToolActive;

  const previewUrl = useScreenRecorderStore((s) => s.lastRecording?.previewUrl);
  const panelHeightPx = useScreenRecorderStore((s) => s.timelinePanelHeight);
  const setPanelHeightPx = useScreenRecorderStore((s) => s.setTimelinePanelHeight);
  const clickPath = useScreenRecorderStore((s) => s.lastRecording?.clickPath ?? EMPTY_CURSOR_PATH);
  const cursorPath = useScreenRecorderStore(
    (s) => s.lastRecording?.cursorPath ?? EMPTY_CURSOR_PATH
  );
  // "Hide webcam" only makes sense to offer when this recording actually has
  // a webcam track and the PiP overlay is currently on -- same gate WebcamPip
  // itself uses to decide whether to render at all.
  const hasWebcamTrack = useScreenRecorderStore((s) => Boolean(s.lastRecording?.webcamPreviewUrl));
  const webcamEnabled = useWebcamStore((s) => s.enabled);
  const waveformPeaks = useWaveformStore((s) => s.peaks);
  const loadWaveformForUrl = useWaveformStore((s) => s.loadForUrl);
  // "Mute clip" only makes sense to offer when the recording actually has an
  // audio track to mute -- decodeWaveformPeaks (waveform-store.ts) fails and
  // leaves `peaks` null when there's none, so its presence doubles as that
  // check without a separate probe.
  const hasAudioTrack = waveformPeaks !== null;

  // Decoded once per recording (cached in the store, keyed by URL) rather
  // than per-clip -- each segment below just slices its own range out of
  // the same peaks array, so re-cutting/reordering never re-decodes audio.
  useEffect(() => {
    if (previewUrl) loadWaveformForUrl(previewUrl);
  }, [previewUrl, loadWaveformForUrl]);

  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();
  const {
    startResize,
    isResizing: isEdgeResizing,
    isResizingRef: edgeResizingRef
  } = useEdgeResize();
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRowRef = useRef<HTMLDivElement>(null);
  const playheadDraggingRef = useRef(false);
  const dragRafIdRef = useRef<number | null>(null);
  const pendingDragClientXRef = useRef<number | null>(null);

  // Auto-grows the panel to fit its content as tracks (Zoom/Caption/
  // Annotation/Blur-Mask) gain pills or their pills stack into more lanes --
  // `trackAreaRef` isn't itself height-constrained (only `scrollContainerRef`
  // around it is, via `overflow-auto`), so its `offsetHeight` always reflects
  // the *true* content height regardless of how much of it currently fits.
  // Grow-only and driven by `getState()`/`setState()` rather than the
  // subscribed `panelHeightPx` value, so back-to-back ResizeObserver firings
  // (e.g. several pills mounting in the same frame) each compare against the
  // latest committed height instead of a stale render's closure -- and so a
  // track shrinking (a pill deleted) never yanks the panel back down under
  // whatever the user's still looking at; only manually dragging the handle
  // does that.
  useEffect(() => {
    const trackArea = trackAreaRef.current;
    const toolbarRow = toolbarRowRef.current;
    if (!trackArea || !toolbarRow) return;

    function recalcAutoHeight(): void {
      const requiredPx =
        toolbarRow!.offsetHeight + trackArea!.offsetHeight + PANEL_CONTENT_CHROME_PX;
      const clampedPx = Math.min(MAX_PANEL_HEIGHT_PX, Math.max(MIN_PANEL_HEIGHT_PX, requiredPx));
      const currentPx = useScreenRecorderStore.getState().timelinePanelHeight;
      if (clampedPx > currentPx)
        useScreenRecorderStore.getState().setTimelinePanelHeight(clampedPx);
    }

    const observer = new ResizeObserver(recalcAutoHeight);
    observer.observe(trackArea);
    recalcAutoHeight();
    return () => observer.disconnect();
  }, []);

  // A second, gray playhead that tracks the cursor while it's over the
  // ruler and live-seeks the preview video to that position -- scrubbing by
  // hover alone, no click/drag needed. `preHoverPlayheadMsRef` remembers
  // where playback actually was before the hover started, so moving the
  // mouse away without clicking snaps the preview back instead of leaving
  // it wherever the cursor last was (a real click/drag commits normally and
  // clears the ref so the leave-restore doesn't undo it).
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const preHoverPlayheadMsRef = useRef<number | null>(null);

  // Playback starting mid-hover (transport bar, spacebar, ...) invalidates
  // the "position to restore on leave" baseline -- clearing just the ref
  // (not React state, so this doesn't fight the set-state-in-effect rule)
  // means a leave-while-playing won't snap playback back to wherever it
  // happened to be when the hover started. The stale `hoverFraction` value
  // itself is masked at render time below (`effectiveHoverFraction`)
  // instead of being reset here, since real playback should just keep
  // going from wherever it already is, not trigger another render.
  // `setIsHoverScrubbing` is a zustand action, not React state, so it's
  // exempt from that same rule -- and it has to be cleared here too, or a
  // hover interrupted by playback starting would leave PreviewStage's rAF
  // loop permanently skipping `setPlayhead`, freezing the main playhead
  // forever even once paused again.
  useEffect(() => {
    if (isPlaying) {
      preHoverPlayheadMsRef.current = null;
      setIsHoverScrubbing(false);
    }
  }, [isPlaying, setIsHoverScrubbing]);
  const effectiveHoverFraction = isPlaying ? null : hoverFraction;

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;

  // Zoom tool's hover position, mapped to source-ms (the coordinate zoom
  // keyframes are authored in -- see PillTrack.tsx) -- passed down so
  // ZoomTrack can draw its own ghost preview in its own row, following
  // wherever the cursor is over the ruler/clip row above it.
  const zoomPreviewSourceMs =
    isZoomToolActive && effectiveHoverFraction !== null
      ? outputMsToSourceMs(segments, effectiveHoverFraction * clampedTotal)
      : null;

  // Each pill's left/width percent, laid out edge-to-edge in output order --
  // computed once here (rather than inline per-segment) since the cut
  // markers below need the same running cursor to find clip boundaries.
  const segmentLayouts = useMemo(
    () =>
      segments.reduce<{
        list: { segment: TimelineSegment; leftPercent: number; widthPercent: number }[];
        cursorMs: number;
      }>(
        (acc, segment) => {
          const outputDurationMs = getSegmentOutputDurationMs(segment);
          const leftPercent = (acc.cursorMs / clampedTotal) * 100;
          const widthPercent = (outputDurationMs / clampedTotal) * 100;
          return {
            list: [...acc.list, { segment, leftPercent, widthPercent }],
            cursorMs: acc.cursorMs + outputDurationMs
          };
        },
        { list: [], cursorMs: 0 }
      ).list,
    [segments, clampedTotal]
  );

  const majorTickIntervalMs = pickMajorTickIntervalMs(totalDurationMs);
  const minorTickIntervalMs = majorTickIntervalMs / 3;
  const tickCount = totalDurationMs > 0 ? Math.floor(totalDurationMs / minorTickIntervalMs) + 1 : 0;
  const ticks = Array.from({ length: tickCount }, (_, i) => ({
    atMs: i * minorTickIntervalMs,
    major: i % 3 === 0
  }));

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackAreaRef.current;
      if (!el || segments.length === 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
      if (sourceMs !== null) requestSeek(sourceMs);
    },
    [segments, clampedTotal, requestSeek]
  );

  // Cut tool's click-to-trim -- computed from the cursor's fraction across
  // the *whole* track area (not the specific segment clicked), since
  // `splitAt` takes an output-ms position and figures out which kept
  // segment covers it internally. That means every click target on the
  // timeline (ruler, or any clip pill) can share this one calculation
  // instead of each needing its own per-segment bounds math.
  const splitFromClientX = useCallback(
    (clientX: number) => {
      const el = trackAreaRef.current;
      if (!el || segments.length === 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      splitAt(fraction * clampedTotal);
    },
    [segments, clampedTotal, splitAt]
  );

  // Zoom tool's click-to-place -- same shared whole-track-area fraction as
  // `splitFromClientX`, just mapped to a *source*-ms position (zoom
  // keyframes are authored against the source recording, not the output
  // timeline -- see PillTrack.tsx) instead of handed to `splitAt` directly.
  // No-ops over a stretch that already has a keyframe -- ZoomTrack hides
  // its ghost there for the same reason (see ZoomTrack.tsx): a click
  // wouldn't add one *here*, it'd silently snap in right after the
  // existing one (clampToNonOverlapping, zoom-store.ts), which isn't what
  // a click on an already-covered stretch should do.
  //
  // `addZoomKeyframe` always creates with `position: 'auto-cursor'`, since
  // that's also the right default for `ZoomKeyframeEditor`'s own "Add
  // keyframe" button -- but a deliberate click on an exact point of the
  // timeline (what the ghost preview promises, see ZoomTrack.tsx) reads more
  // as "zoom in on whatever's here" than "start tracking the mouse for the
  // next few seconds", so this path immediately follows up with a fixed
  // position instead, same resolution `ZoomTrack`'s "disable follow cursor"
  // uses. Reads the just-created keyframe back from the store (rather than
  // the requested `sourceMs`/default duration) since `addZoomKeyframe`
  // clamps both against neighboring keyframes.
  const placeZoomKeyframeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackAreaRef.current;
      if (!el || segments.length === 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
      if (sourceMs === null) return;
      if (findKeyframeContaining(zoomKeyframes, sourceMs)) return;
      const id = addZoomKeyframe(sourceMs);
      const created = useZoomStore.getState().keyframes.find((kf) => kf.id === id);
      if (created) {
        updateZoomKeyframe(id, {
          position: resolveFixedPosition(clickPath, cursorPath, created.atMs, created.durationMs)
        });
      }
      selectZoomKeyframe(id);
      setActiveTool('zoom');
    },
    [
      segments,
      clampedTotal,
      zoomKeyframes,
      addZoomKeyframe,
      updateZoomKeyframe,
      clickPath,
      cursorPath,
      setActiveTool
    ]
  );

  // rAF-throttled, not one `requestSeek` per raw `pointermove` -- a fast
  // drag can fire that event far more often than once per frame, and
  // `requestSeek` (unlike hover-scrub's `previewSeek`) also writes
  // `playheadMs`, which re-renders every track/tick/pill subscribed to it
  // (see Playhead.tsx's own doc on why it's split out for exactly this
  // reason). Collapsing to the latest clientX per frame cuts that fan-out
  // down to the screen's actual refresh rate instead of the pointer's.
  const handlePlayheadDragMove = useCallback(
    (event: PointerEvent) => {
      if (!playheadDraggingRef.current) return;
      pendingDragClientXRef.current = event.clientX;
      if (dragRafIdRef.current !== null) return;
      dragRafIdRef.current = requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        const clientX = pendingDragClientXRef.current;
        if (clientX !== null) seekFromClientX(clientX);
      });
    },
    [seekFromClientX]
  );

  const stopPlayheadDrag = useCallback(() => {
    playheadDraggingRef.current = false;
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    pendingDragClientXRef.current = null;
    window.removeEventListener('pointermove', handlePlayheadDragMove);
  }, [handlePlayheadDragMove]);

  function startPlayheadDrag(event: React.PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    playheadDraggingRef.current = true;
    setHoverFraction(null);
    preHoverPlayheadMsRef.current = null;
    seekFromClientX(event.clientX);
    window.addEventListener('pointermove', handlePlayheadDragMove);
    window.addEventListener('pointerup', stopPlayheadDrag, { once: true });
  }

  function handleRulerClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (isCutToolActive) {
      splitFromClientX(event.clientX);
      return;
    }
    if (isZoomToolActive) {
      placeZoomKeyframeFromClientX(event.clientX);
      return;
    }
    preHoverPlayheadMsRef.current = null;
    seekFromClientX(event.clientX);
  }

  function handleRulerPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    // Ignore events bubbled here from a portaled ContextMenu (React bubbles through the component tree, not the DOM tree).
    if (!event.currentTarget.contains(event.target as Node)) return;
    // Hover-scrub only live-previews while paused -- while actually
    // playing back, a hovering mouse shouldn't fight the running playback
    // position. Dragging the *main* playhead handle (startPlayheadDrag)
    // still works regardless of play state. Also off while the cursor is
    // mid-drag on something else draggable (a clip edge being resized),
    // so hover-scrub doesn't fight that interaction either.
    if (isPlaying || playheadDraggingRef.current || edgeResizingRef.current) return;
    const el = trackAreaRef.current;
    if (!el || segments.length === 0) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverFraction(fraction);

    if (preHoverPlayheadMsRef.current === null) {
      preHoverPlayheadMsRef.current = useTimelineStore.getState().playheadMs;
      setIsHoverScrubbing(true);
    }
    // `previewSeek` (not `requestSeek`) -- moves the actual video so the
    // preview shows this frame, but deliberately leaves `playheadMs` alone
    // so the *main* blue playhead stays put and only the gray hover marker
    // (positioned from `hoverFraction` above) follows the cursor. The main
    // playhead only catches up once the hover is committed or cancelled
    // (see handleHoverRelease/handleRulerPointerLeave below).
    const sourceMs = outputMsToSourceMs(segments, fraction * clampedTotal);
    if (sourceMs !== null) previewSeek(sourceMs);
  }

  // Releasing the mouse anywhere over the hover-scrub area (ruler or clip
  // row) commits the current cursor position as the real seek -- same body
  // as `handleRulerClick`, just reached via pointerup instead of click so
  // it also covers releasing over a clip (which separately selects it).
  // Uses `requestSeek` (not `previewSeek`), so this is the moment the main
  // playhead actually jumps to the released position. Skipped while
  // playing, dragging the main playhead, or mid-edge-resize, same as
  // `handleRulerPointerMove` -- releasing off the end of one of those
  // interactions shouldn't also fire a seek.
  function handleHoverRelease(event: React.PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.target as Node)) return;
    // A right-click also fires pointerup (unlike the native `click` event `handleRulerClick` uses, which is left-button only) -- without this, opening a clip's context menu would also seek.
    if (event.button === 2) return;
    if (isPlaying || playheadDraggingRef.current || edgeResizingRef.current) return;
    preHoverPlayheadMsRef.current = null;
    setIsHoverScrubbing(false);
    seekFromClientX(event.clientX);
  }

  function handleRulerPointerLeave(): void {
    setHoverFraction(null);
    if (preHoverPlayheadMsRef.current !== null) {
      setIsHoverScrubbing(false);
      requestSeek(preHoverPlayheadMsRef.current);
      preHoverPlayheadMsRef.current = null;
    }
  }

  function startResizeHandler(
    segment: TimelineSegment,
    edge: 'start' | 'end',
    blockWidthPx: number
  ) {
    const durationMs = segment.range.endMs - segment.range.startMs;
    const startValueMs = edge === 'start' ? segment.range.startMs : segment.range.endMs;
    return startResize(startValueMs, durationMs, blockWidthPx, (newMs) =>
      resizeSegmentEdge(segment.id, edge, newMs)
    );
  }

  function handleDoubleClick(
    segment: TimelineSegment,
    index: number,
    event: React.MouseEvent<HTMLDivElement>
  ) {
    // A single click already performs the cut/zoom-place while a tool is
    // armed (see the segment wrapper's onClick below) -- without this
    // guard, a real double-click would fire two clicks (two cuts/keyframes)
    // *and* this handler, attempting a third split against a since-stale
    // segment/index.
    if (isPointerToolActive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const outputStart = segments
      .slice(0, index)
      .reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
    const outputDurationMs = getSegmentOutputDurationMs(segment);
    splitAt(outputStart + fraction * outputDurationMs);
  }

  return (
    <ResizablePanel
      edge="top"
      size={panelHeightPx}
      onResize={setPanelHeightPx}
      min={MIN_PANEL_HEIGHT_PX}
      max={MAX_PANEL_HEIGHT_PX}
      className="flex w-full flex-col rounded-lg border border-line bg-surface"
      handleClassName="z-40"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
        <div ref={toolbarRowRef} className="flex shrink-0 items-center gap-1">
          <Tooltip.Provider delay={300} closeDelay={0}>
            <div className="flex items-center gap-1">
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-30"
                    >
                      <Undo2 size={14} />
                    </button>
                  }
                />
                <Tooltip.Content>Undo</Tooltip.Content>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-30"
                    >
                      <Redo2 size={14} />
                    </button>
                  }
                />
                <Tooltip.Content>Redo</Tooltip.Content>
              </Tooltip.Root>

              <div className="mx-1 h-4 w-px bg-line" />

              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <button
                      onClick={() => setCutToolActive(!isCutToolActive)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                        isCutToolActive ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2'
                      )}
                    >
                      <Scissors size={13} />
                    </button>
                  }
                />
                <Tooltip.Content>
                  {isCutToolActive
                    ? 'Cut tool active (C or Esc to exit) -- click the timeline to trim'
                    : 'Cut tool (C) -- click to arm, then click the timeline to trim'}
                </Tooltip.Content>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <button
                      onClick={() => setZoomToolActive(!isZoomToolActive)}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                        isZoomToolActive ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2'
                      )}
                    >
                      <ZoomIn size={13} />
                    </button>
                  }
                />
                <Tooltip.Content>
                  {isZoomToolActive
                    ? 'Zoom tool active (Z or Esc to exit) -- click the timeline to place a keyframe'
                    : 'Zoom tool (Z) -- click to arm, then click the timeline to place a keyframe'}
                </Tooltip.Content>
              </Tooltip.Root>

              <div className="mx-1 h-4 w-px bg-line" />

              <span className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clapperboard size={12} /> {segments.length} clip{segments.length === 1 ? '' : 's'}
              </span>
            </div>
          </Tooltip.Provider>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTimelineZoom(Math.max(MIN_TIMELINE_ZOOM, zoom - 0.5))}
              title="Zoom out timeline"
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2"
            >
              <Minus size={13} />
            </button>
            <Slider
              value={zoom}
              min={MIN_TIMELINE_ZOOM}
              max={MAX_TIMELINE_ZOOM}
              step={0.5}
              onChange={setTimelineZoom}
              className="w-24"
            />
            <button
              onClick={() => setTimelineZoom(Math.min(MAX_TIMELINE_ZOOM, zoom + 0.5))}
              title="Zoom in timeline"
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/*
          Every track (ruler, clips, Zoom/Caption/Speed/Crop pills) lives
          inside this one zoom-scaled, horizontally-scrolling container so
          they share a single coordinate space -- percentages computed
          against `clampedTotal` line up across rows at any zoom level or
          scroll position, and the playhead (last child, absolutely
          positioned) spans the full stack instead of just the ruler.
          `TIMELINE_SCROLL_PADDING_PX` reserves just enough horizontal room
          in the scrollable padding box for a `CutMarker` centered exactly on
          a cut at the very start/end of the timeline (half its `w-9` pin) to
          render fully -- otherwise the first clip's own head trim clips its
          marker against this container's edge, since `overflow-auto` only
          leaves the padding box unclipped, not anything past it. Doesn't
          affect alignment between rows: it's padding on this *outer* scroll
          container, not a margin/inset on `trackAreaRef` itself, so every
          row's own percent-of-`trackAreaRef` math is untouched -- but
          `Playhead.tsx`'s scroll-into-view effect *does* need to know this
          exact number, since it translates between `trackAreaRef`-relative
          and `scrollLeft`-relative coordinates (see that file).
        */}
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto bg-dotted"
          style={{
            paddingLeft: TIMELINE_SCROLL_PADDING_PX,
            paddingRight: TIMELINE_SCROLL_PADDING_PX
          }}
        >
          <div
            ref={trackAreaRef}
            className="relative flex min-h-full flex-col gap-1.5"
            style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
            onPointerMove={handleRulerPointerMove}
            onPointerLeave={handleRulerPointerLeave}
            onPointerUp={handleHoverRelease}
          >
            <div className="relative flex flex-col gap-1.5">
              <div
                onClick={handleRulerClick}
                title={
                  isCutToolActive
                    ? 'Click to trim at this position'
                    : isZoomToolActive
                      ? 'Click to place a zoom keyframe here'
                      : 'Click to scrub -- hover to preview a position'
                }
                className={cn(
                  'relative h-6 shrink-0 select-none mx-3',
                  isPointerToolActive ? 'cursor-crosshair' : 'cursor-pointer'
                )}
              >
                {ticks.map(({ atMs, major }) => (
                  <div
                    key={atMs}
                    className="pointer-events-none absolute top-0"
                    style={{ left: `${(atMs / clampedTotal) * 100}%` }}
                  >
                    {major ? (
                      <>
                        <div className="h-2 w-px bg-border-dark" />
                        <span className="absolute left-0 top-2.5 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground">
                          {formatTime(atMs)}
                        </span>
                      </>
                    ) : (
                      <div className="absolute left-0 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-border" />
                    )}
                  </div>
                ))}
              </div>

              <div
                className="relative"
                style={{ height: CLIP_PILL_HEIGHT_PX, marginTop: CUT_MARKER_RESERVED_PX }}
              >
                {segmentLayouts.map(({ segment, leftPercent, widthPercent }, index) => {
                  const isSelected = selectedSegmentId === segment.id;
                  const gapBeforeMs = gapBeforeSegmentMs(segments, index);

                  const hasCutBoundary = index > 0 || gapBeforeMs > MIN_CUT_MARKER_GAP_MS;
                  const dragHandlers = getDragHandlers(index);
                  return (
                    <motion.div
                      key={segment.id}
                      layout="position"
                      transition={
                        isEdgeResizing
                          ? { duration: 0 }
                          : { type: 'tween', duration: 0.2, ease: 'easeOut' }
                      }
                      className="absolute inset-y-0 min-w-12"
                      style={{
                        left: `calc(${leftPercent}% + ${CLIP_GAP_PX / 2}px)`,
                        width: `calc(${widthPercent}% - ${CLIP_GAP_PX}px)`
                      }}
                    >
                      <ContextMenu.Root>
                        <ContextMenu.Trigger
                          render={
                            <div
                              {...dragHandlers}
                              draggable={!isPointerToolActive && dragHandlers.draggable}
                              onClick={(e) => {
                                if (isCutToolActive) {
                                  splitFromClientX(e.clientX);
                                  return;
                                }
                                if (isZoomToolActive) {
                                  placeZoomKeyframeFromClientX(e.clientX);
                                  return;
                                }
                                selectClipSegment(segment.id);
                              }}
                              onDoubleClick={(e) => handleDoubleClick(segment, index, e)}
                              className={cn(
                                'group absolute inset-0',
                                isPointerToolActive
                                  ? 'cursor-crosshair'
                                  : 'cursor-grab active:cursor-grabbing'
                              )}
                            >
                              <div
                                className={cn(
                                  'relative flex h-full items-center justify-center overflow-hidden rounded-xl border border-orange-900/40',
                                  dragOverIndex === index && 'ring-2 ring-accent',
                                  dragOverIndex !== index && isSelected && 'ring-2 ring-accent'
                                )}
                              >
                                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-blue-500 via-blue-400 to-blue-400" />
                                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/35 via-white/5 to-black/15" />

                                {waveformPeaks && (
                                  <SegmentWaveform
                                    segment={segment}
                                    peaks={waveformPeaks}
                                    sourceDurationMs={sourceDurationMs}
                                  />
                                )}

                                <div className="pointer-events-none relative flex flex-col items-center gap-0.5 px-2 text-orange-950/70">
                                  <span className="flex items-center gap-1 truncate text-[10px] font-semibold">
                                    <Clapperboard size={10} className="shrink-0" />
                                    Clip
                                  </span>
                                  <span className="flex items-center gap-1 truncate text-[10px] text-orange-950/60">
                                    {formatShortDuration(getSegmentOutputDurationMs(segment))}
                                    <Gauge size={9} className="shrink-0" />
                                    {segment.speed}x
                                  </span>
                                </div>

                                <div
                                  onPointerDown={(e) => {
                                    // A tool armed: leave the pointerdown alone
                                    // so it bubbles to the wrapper's onClick
                                    // above and cuts/places there instead of
                                    // starting a resize. A split clip's range
                                    // is locked (see `TimelineSegment.split`),
                                    // so the drag never starts there either.
                                    if (isPointerToolActive || segment.split) return;
                                    const width =
                                      e.currentTarget.parentElement?.getBoundingClientRect()
                                        .width ?? 0;
                                    startResizeHandler(segment, 'start', width)(e);
                                  }}
                                  title={segment.split ? 'Locked -- this edge is a cut' : undefined}
                                  className={cn(
                                    'absolute inset-y-0 left-0 w-1.5 bg-black/10',
                                    segment.split
                                      ? 'cursor-default'
                                      : 'cursor-ew-resize hover:bg-black/25'
                                  )}
                                />
                                <div
                                  onPointerDown={(e) => {
                                    if (isPointerToolActive || segment.split) return;
                                    const width =
                                      e.currentTarget.parentElement?.getBoundingClientRect()
                                        .width ?? 0;
                                    startResizeHandler(segment, 'end', width)(e);
                                  }}
                                  title={segment.split ? 'Locked -- this edge is a cut' : undefined}
                                  className={cn(
                                    'absolute inset-y-0 right-0 w-1.5 bg-black/10',
                                    segment.split
                                      ? 'cursor-default'
                                      : 'cursor-ew-resize hover:bg-black/25'
                                  )}
                                />
                              </div>

                              {/*
                              Cut marker for the boundary just before this
                              clip -- shown for every split, not just once a
                              trim opens a visible gap, so the marker stays
                              put as soon as the cut is made rather than
                              appearing only after the user later drags an
                              edge. Duration prefers the actual trimmed-away
                              footage when there is any (a deleted or
                              ripple-trimmed stretch); a plain split has none
                              of that yet, so it falls back to this clip's
                              own output duration instead of showing nothing.
                              Always centered exactly on the boundary it
                              describes (via `CutMarker`'s anchor+translate
                              pairing), including the first clip's own head
                              cut.
                            */}
                              {hasCutBoundary && (
                                <CutMarker
                                  durationMs={
                                    gapBeforeMs > MIN_CUT_MARKER_GAP_MS
                                      ? gapBeforeMs
                                      : getSegmentOutputDurationMs(segment)
                                  }
                                  anchorClassName="-translate-x-1/2"
                                />
                              )}
                            </div>
                          }
                        />
                        <ContextMenu.Content>
                          <ContextMenu.SubmenuRoot>
                            <ContextMenu.SubmenuTrigger>
                              <Gauge size={13} className="shrink-0" />
                              Set speed
                            </ContextMenu.SubmenuTrigger>
                            <ContextMenu.Content>
                              <ContextMenu.RadioGroup
                                value={segment.speed}
                                onValueChange={(value) =>
                                  setSegmentSpeed(segment.id, value as typeof segment.speed)
                                }
                              >
                                {CLIP_SPEED_OPTIONS.map((speed) => (
                                  <ContextMenu.RadioItem key={speed} value={speed}>
                                    {speed}x
                                  </ContextMenu.RadioItem>
                                ))}
                              </ContextMenu.RadioGroup>
                            </ContextMenu.Content>
                          </ContextMenu.SubmenuRoot>
                          {hasAudioTrack && (
                            <ContextMenu.SubmenuRoot>
                              <ContextMenu.SubmenuTrigger>
                                <Volume2 size={13} className="shrink-0" />
                                Set volume
                              </ContextMenu.SubmenuTrigger>
                              <ContextMenu.Content>
                                <ContextMenu.RadioGroup
                                  value={segment.audioVolume}
                                  onValueChange={(value) =>
                                    setSegmentAudioVolume(segment.id, value as number)
                                  }
                                >
                                  {AUDIO_VOLUME_OPTIONS.map((volume) => (
                                    <ContextMenu.RadioItem key={volume} value={volume}>
                                      {Math.round(volume * 100)}%
                                    </ContextMenu.RadioItem>
                                  ))}
                                </ContextMenu.RadioGroup>
                              </ContextMenu.Content>
                            </ContextMenu.SubmenuRoot>
                          )}
                          <ContextMenu.Separator />
                          {!isLikelyLinux && (
                            <ContextMenu.Item
                              onClick={() =>
                                setSegmentCursorHidden(segment.id, !segment.cursorHidden)
                              }
                            >
                              <span className="flex items-center gap-2">
                                {segment.cursorHidden ? (
                                  <EyeOff size={13} className="shrink-0" />
                                ) : (
                                  <Eye size={13} className="shrink-0" />
                                )}
                                {segment.cursorHidden ? 'Show mouse cursor' : 'Hide mouse cursor'}
                              </span>
                            </ContextMenu.Item>
                          )}
                          {hasWebcamTrack && webcamEnabled && (
                            <ContextMenu.Item
                              onClick={() =>
                                setSegmentWebcamHidden(segment.id, !segment.webcamHidden)
                              }
                            >
                              <span className="flex items-center gap-2">
                                {segment.webcamHidden ? (
                                  <VideoOff size={13} className="shrink-0" />
                                ) : (
                                  <Video size={13} className="shrink-0" />
                                )}
                                {segment.webcamHidden ? 'Show webcam' : 'Hide webcam'}
                              </span>
                            </ContextMenu.Item>
                          )}
                          {hasAudioTrack && (
                            <ContextMenu.Item
                              onClick={() => setSegmentAudioMuted(segment.id, !segment.audioMuted)}
                            >
                              <span className="flex items-center gap-2">
                                {segment.audioMuted ? (
                                  <VolumeX size={13} className="shrink-0" />
                                ) : (
                                  <Volume2 size={13} className="shrink-0" />
                                )}
                                {segment.audioMuted ? 'Unmute clip' : 'Mute clip'}
                              </span>
                            </ContextMenu.Item>
                          )}

                          <ContextMenu.Separator />
                          <ContextMenu.Item
                            onClick={() => resetSegmentTrim(segment.id)}
                            disabled={!segment.trimmed && !hasMergeableCutBoundary(segments, index)}
                          >
                            <span className="flex items-center gap-2">
                              <RotateCcw size={13} className="shrink-0" />
                              Reset trim
                            </span>
                          </ContextMenu.Item>
                          <ContextMenu.Item
                            onClick={() => deleteSegment(segment.id)}
                            disabled={segments.length <= 1}
                            className="text-danger data-[highlighted]:text-danger"
                          >
                            <span className="flex items-center gap-2">
                              <Trash2 size={13} className="shrink-0" />
                              Delete
                            </span>
                          </ContextMenu.Item>
                        </ContextMenu.Content>
                      </ContextMenu.Root>
                    </motion.div>
                  );
                })}

                {/*
                  Cut tool's live preview -- the same pin shape as a real
                  cut marker, but with no duration (nothing's actually been
                  cut yet) and following the cursor continuously rather than
                  sitting fixed at a clip boundary. Rendered inside this same
                  clip-row container (not the outer ruler+row wrapper below)
                  so its `-top-*` offset is relative to the row's own top
                  edge, exactly like the real markers above.
                */}
                {isCutToolActive && effectiveHoverFraction !== null && (
                  <div
                    className="pointer-events-none absolute top-0 z-20"
                    style={{ left: `${effectiveHoverFraction * 100}%` }}
                  >
                    <CutMarker anchorClassName="-translate-x-1/2" />
                  </div>
                )}
              </div>
            </div>

            <ZoomTrack previewAtSourceMs={zoomPreviewSourceMs} />
            <CaptionTrack />
            <AnnotationTrack />
            <BlurMaskTrack />

            {effectiveHoverFraction !== null && !isCutToolActive && (
              <div
                className="pointer-events-none absolute inset-y-0 z-5 mx-0.5"
                style={{ left: `${effectiveHoverFraction * 100}%` }}
              >
                <div className="absolute inset-y-0 left-0 w-0.5 bg-muted-foreground/40" />
                <div className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full border border-border-dark bg-surface" />
              </div>
            )}

            <Playhead
              segments={segments}
              clampedTotal={clampedTotal}
              onPointerDown={startPlayheadDrag}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        </div>
      </div>
    </ResizablePanel>
  );
}
