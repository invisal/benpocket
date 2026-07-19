import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Gauge, Scissors } from 'lucide-react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore } from '../store/timeline-store';
import { useWaveformStore } from '../store/waveform-store';
import { getSegmentOutputDurationMs, outputMsToSourceMs } from '../lib/segment-duration';
import { CLIP_ROW_HEIGHT_PX } from '../lib/assign-lanes';
import { useEdgeResize } from '../lib/use-edge-resize';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { useZoomStore, findKeyframeContaining } from '../../zoom/store/zoom-store';
import { ZoomTrack } from '../../zoom/components/ZoomTrack';
import { CropTrack } from '../../crop/components/CropTrack';
import { CaptionTrack } from '../../captions/components/CaptionTrack';
import { AnnotationTrack } from '../../annotations/components/AnnotationTrack';
import { BlurMaskTrack } from '../../blur-mask/components/BlurMaskTrack';
import { SpeedTrack } from './SpeedTrack';
import { Playhead } from './Playhead';
import { SegmentWaveform } from './SegmentWaveform';
import { cn } from '../../../lib/utils';

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
const DEFAULT_PANEL_HEIGHT_PX = 180;
const MIN_PANEL_HEIGHT_PX = 150;
const MAX_PANEL_HEIGHT_PX = 300;

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

interface PanelResize {
  startClientY: number;
  startHeightPx: number;
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
        <div className="absolute inset-0 -rotate-45 rounded-[50%_50%_50%_0] border-2 border-blue-500 bg-neutral-900 shadow-sm" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-px pt-0.5">
          <Scissors size={12} className="text-white" />
          {durationMs !== undefined && (
            <span className="whitespace-nowrap text-[9px] font-medium leading-none text-white/85">
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
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const zoom = useTimelineStore((s) => s.timelineZoom);
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const previewSeek = useTimelineStore((s) => s.previewSeek);
  const setIsHoverScrubbing = useTimelineStore((s) => s.setIsHoverScrubbing);
  const splitAt = useTimelineStore((s) => s.splitAt);
  const deleteSegment = useTimelineStore((s) => s.deleteSegment);
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
  // Armed from the ZoomIn button -- same idea, but a click adds a zoom
  // keyframe at the cursor instead of splitting; ZoomTrack (rendered below)
  // gets the hovered position as a prop and draws its own ghost preview.
  const isZoomToolActive = useTimelineStore((s) => s.isZoomToolActive);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const addZoomKeyframe = useZoomStore((s) => s.addKeyframe);
  const setSelectedZoomKeyframeId = useZoomStore((s) => s.setSelectedKeyframeId);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  // Any "arm a tool, then click the timeline" mode currently active -- both
  // suppress the clip row's normal select/drag/resize/double-click-to-split
  // interactions the same way, so their guards share this one flag.
  const isPointerToolActive = isCutToolActive || isZoomToolActive;

  const previewUrl = useAppStore((s) => s.lastRecording?.previewUrl);
  const waveformPeaks = useWaveformStore((s) => s.peaks);
  const loadWaveformForUrl = useWaveformStore((s) => s.loadForUrl);
  // Decoded once per recording (cached in the store, keyed by URL) rather
  // than per-clip -- each segment below just slices its own range out of
  // the same peaks array, so re-cutting/reordering never re-decodes audio.
  useEffect(() => {
    if (previewUrl) loadWaveformForUrl(previewUrl);
  }, [previewUrl, loadWaveformForUrl]);

  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();
  const { startResize } = useEdgeResize();
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const playheadDraggingRef = useRef(false);
  // Set for the duration of an edge-resize drag (useEdgeResize tracks its
  // own drag state internally, via a `window` pointermove/pointerup pair
  // that don't go through this component, so it doesn't already know when
  // one is active) -- keeps hover-scrub from also seeking while the user is
  // mid-resize on a clip's edge.
  const edgeResizingRef = useRef(false);

  function markEdgeResizeActive(): void {
    edgeResizingRef.current = true;
    window.addEventListener(
      'pointerup',
      () => {
        edgeResizingRef.current = false;
      },
      { once: true }
    );
  }

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

  // Panel height is self-managed (not lifted to EditorPage) so the timeline
  // is an independently resizable strip spanning the full editor width.
  const [panelHeightPx, setPanelHeightPx] = useState(DEFAULT_PANEL_HEIGHT_PX);
  const panelResizeRef = useRef<PanelResize | null>(null);

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
      setSelectedZoomKeyframeId(id);
      setActiveTool('zoom');
    },
    [
      segments,
      clampedTotal,
      zoomKeyframes,
      addZoomKeyframe,
      setSelectedZoomKeyframeId,
      setActiveTool
    ]
  );

  const handlePlayheadDragMove = useCallback(
    (event: PointerEvent) => {
      if (!playheadDraggingRef.current) return;
      seekFromClientX(event.clientX);
    },
    [seekFromClientX]
  );

  const stopPlayheadDrag = useCallback(() => {
    playheadDraggingRef.current = false;
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

  const handlePanelResizeMove = useCallback((event: PointerEvent) => {
    const drag = panelResizeRef.current;
    if (!drag) return;
    // The panel is pinned to the bottom of the editor, so dragging the top
    // edge upward (clientY decreasing) should grow it.
    const deltaPx = drag.startClientY - event.clientY;
    const next = Math.min(
      MAX_PANEL_HEIGHT_PX,
      Math.max(MIN_PANEL_HEIGHT_PX, drag.startHeightPx + deltaPx)
    );
    setPanelHeightPx(next);
  }, []);

  const stopPanelResize = useCallback(() => {
    panelResizeRef.current = null;
    window.removeEventListener('pointermove', handlePanelResizeMove);
  }, [handlePanelResizeMove]);

  function startPanelResize(event: React.PointerEvent): void {
    event.preventDefault();
    panelResizeRef.current = { startClientY: event.clientY, startHeightPx: panelHeightPx };
    window.addEventListener('pointermove', handlePanelResizeMove);
    window.addEventListener('pointerup', stopPanelResize, { once: true });
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
    <div
      className="flex w-full shrink-0 flex-col border-t border-line bg-surface-raised"
      style={{ height: panelHeightPx }}
    >
      <div
        onPointerDown={startPanelResize}
        title="Drag to resize the timeline"
        className="h-1.5 shrink-0 cursor-row-resize bg-transparent hover:bg-accent/70"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
        {/* <div className="flex shrink-0 items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Clapperboard size={12} /> {segments.length} clip{segments.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
            {formatTime(totalDurationMs)} total
          </span>
          <span className="ml-auto text-white/30">
            Click to select · double-click to split · drag to reorder, trim, or scrub
          </span>
        </div> */}

        {/*
          Every track (ruler, clips, Zoom/Caption/Speed/Crop pills) lives
          inside this one zoom-scaled, horizontally-scrolling container so
          they share a single coordinate space -- percentages computed
          against `clampedTotal` line up across rows at any zoom level or
          scroll position, and the playhead (last child, absolutely
          positioned) spans the full stack instead of just the ruler.
        */}
        <div ref={scrollContainerRef} className="min-h-0 flex-1 px-1 overflow-auto">
          <div
            ref={trackAreaRef}
            className="relative flex flex-col gap-1.5"
            style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
          >
            {/*
              Ruler + clip row share a `relative` wrapper (distinct from
              trackAreaRef, which holds the *real* Playhead spanning every
              track) so the gray hover-scrub marker can be sized to just
              these two rows via `inset-y-0` instead of hand-computing a
              pixel height that would drift if either row's height changes.
              Hover tracking lives on this wrapper (not just the ruler) so
              hovering the clip row also live-previews -- click-to-seek
              stays ruler-only below, since a click on a clip is already
              spoken for (selects it).
            */}
            <div
              className="relative flex flex-col gap-1.5"
              onPointerMove={handleRulerPointerMove}
              onPointerLeave={handleRulerPointerLeave}
              onPointerUp={handleHoverRelease}
            >
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
                        <div className="h-2 w-px bg-white/25" />
                        <span className="absolute left-0 top-2.5 -translate-x-1/2 whitespace-nowrap text-[9px] text-white/40">
                          {formatTime(atMs)}
                        </span>
                      </>
                    ) : (
                      <div className="absolute left-0 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-white/20" />
                    )}
                  </div>
                ))}
              </div>

              {/*
                Kept clips draw as individual rounded pills with a real gap
                between them (not one continuous bar) -- each pill is
                absolutely positioned from `segmentLayouts`' own left/width
                percent (inset by `CLIP_GAP_PX` on both edges) rather than
                laid out with a flex `gap`, so the percentages stay exact and
                every other track's percent-based math (ruler ticks,
                playhead) keeps lining up regardless of clip count.
                `marginTop` reserves room above for the floating
                scissors/duration badges to sit fully above the row.
              */}
              <div
                className="relative"
                style={{ height: CLIP_PILL_HEIGHT_PX, marginTop: CUT_MARKER_RESERVED_PX }}
              >
                {segmentLayouts.map(({ segment, leftPercent, widthPercent }, index) => {
                  const isSelected = selectedSegmentId === segment.id;
                  const gapBeforeMs = gapBeforeSegmentMs(segments, index);
                  const dragHandlers = getDragHandlers(index);
                  return (
                    // ContextMenu.Root doesn't render a DOM node of its own,
                    // so it's a transparent wrapper around the same element
                    // structure this used to return directly -- the outer
                    // element still owns position/interaction only (no
                    // `overflow-hidden`), since a trim badge is `absolute
                    // -top-*` from *this* box and must live outside the inner
                    // pill's own `overflow-hidden`, or it'd clip its own badge.
                    <ContextMenu.Root key={segment.id}>
                      <ContextMenu.Trigger
                        render={
                          <div
                            {...dragHandlers}
                            draggable={!isPointerToolActive && dragHandlers.draggable}
                            onClick={(e) => {
                              // A tool armed: a click anywhere on a clip
                              // cuts/places a keyframe at the exact cursor
                              // position (via the shared whole-track-area
                              // calculations), rather than selecting --
                              // which segment was clicked doesn't matter,
                              // both helpers resolve position on their own.
                              if (isCutToolActive) {
                                splitFromClientX(e.clientX);
                                return;
                              }
                              if (isZoomToolActive) {
                                placeZoomKeyframeFromClientX(e.clientX);
                                return;
                              }
                              setSelectedSegmentId(segment.id);
                            }}
                            onDoubleClick={(e) => handleDoubleClick(segment, index, e)}
                            className={cn(
                              'group absolute inset-y-0 min-w-12',
                              isPointerToolActive
                                ? 'cursor-crosshair'
                                : 'cursor-grab active:cursor-grabbing'
                            )}
                            style={{
                              left: `calc(${leftPercent}% + ${CLIP_GAP_PX / 2}px)`,
                              width: `calc(${widthPercent}% - ${CLIP_GAP_PX}px)`
                            }}
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
                                  // starting a resize.
                                  if (isPointerToolActive) return;
                                  const width =
                                    e.currentTarget.parentElement?.getBoundingClientRect().width ??
                                    0;
                                  markEdgeResizeActive();
                                  startResizeHandler(segment, 'start', width)(e);
                                }}
                                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                              />
                              <div
                                onPointerDown={(e) => {
                                  if (isPointerToolActive) return;
                                  const width =
                                    e.currentTarget.parentElement?.getBoundingClientRect().width ??
                                    0;
                                  markEdgeResizeActive();
                                  startResizeHandler(segment, 'end', width)(e);
                                }}
                                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                              />
                            </div>

                            {/*
                              Cut marker for footage trimmed off just before
                              this clip -- the head trim for the first clip,
                              otherwise a ripple-closed gap to the previous
                              one. Always centered exactly on the boundary
                              it describes (via `CutMarker`'s anchor+translate
                              pairing), including the first clip's own head
                              cut.
                            */}
                            {gapBeforeMs > MIN_CUT_MARKER_GAP_MS && (
                              <CutMarker
                                durationMs={gapBeforeMs}
                                anchorClassName="-translate-x-1/2"
                              />
                            )}
                          </div>
                        }
                      />
                      <ContextMenu.Content>
                        <ContextMenu.Item
                          onClick={() => deleteSegment(segment.id)}
                          disabled={segments.length <= 1}
                        >
                          Delete
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </ContextMenu.Root>
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

              {/* Plain gray hover-scrub marker -- swapped out for the cut-tool's pin preview above while that tool is armed, so the two don't visually double up. */}
              {effectiveHoverFraction !== null && !isCutToolActive && (
                <div
                  className="pointer-events-none absolute inset-y-0.5 z-5 mx-0.5"
                  style={{ left: `${effectiveHoverFraction * 100}%` }}
                >
                  <div className="absolute inset-y-0 left-0 w-0.5 bg-white/40" />
                  <div className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full border border-black/40 bg-white/70" />
                </div>
              )}
            </div>

            <ZoomTrack previewAtSourceMs={zoomPreviewSourceMs} />
            <CaptionTrack />
            <AnnotationTrack />
            <BlurMaskTrack />
            <SpeedTrack />
            <CropTrack />

            <Playhead
              segments={segments}
              clampedTotal={clampedTotal}
              onPointerDown={startPlayheadDrag}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
