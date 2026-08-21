import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../store/timeline-store';
import { useWaveformStore } from '../store/waveform-store';
import { getSegmentOutputDurationMs, outputMsToSourceMs } from '../lib/segment-duration';
import { TIMELINE_SCROLL_PADDING_PX } from '../lib/assign-lanes';
import { useEdgeResize } from '../lib/use-edge-resize';
import { useTimelineClickRouter } from '../lib/use-timeline-click-router';
import { useHoverScrub } from '../lib/use-hover-scrub';
import { usePlayheadDrag } from '../lib/use-playhead-drag';
import { useAutoGrowPanelHeight } from '../lib/use-auto-grow-panel-height';
import { ZoomTrack } from '../../zoom/components/ZoomTrack';
import { CaptionTrack } from '../../captions/components/CaptionTrack';
import { AnnotationTrack } from '../../annotations/components/AnnotationTrack';
import { BlurMaskTrack } from '../../blur-mask/components/BlurMaskTrack';
import { CutTimelineToolbar } from './CutTimelineToolbar';
import { TimelineRuler } from './TimelineRuler';
import { ClipRow } from './ClipRow';
import { HoverScrubMarker } from './HoverScrubMarker';
import { Playhead } from './Playhead';

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
// the panel's required height that isn't covered by measuring the toolbar
// row / track area directly (see useAutoGrowPanelHeight).
const PANEL_CONTENT_CHROME_PX = 24 + 10;

/**
 * The primary cut/trim editor: kept segments are packed edge-to-edge in
 * output order (not laid out at their original source position), so
 * removing the middle of a recording visibly closes the gap -- "ripple"
 * editing, same idea as any NLE timeline.
 *
 * Mostly an orchestrator: the toolbar, ruler, clip row, and other-track
 * pills are their own components (mostly self-contained, reading their own
 * feature store directly); this component owns only the state genuinely
 * shared between them -- the zoom-scaled track area's own DOM ref (every
 * row's click/hover position math is computed against it), and the
 * hover-scrub/playhead-drag/edge-resize interactions that have to coordinate
 * with each other to avoid fighting over the same pointer.
 *
 * Takes no props -- selection and zoom live in the timeline store (not
 * component state) so this can be rendered independently of EditorPage,
 * e.g. as a full-width strip in ScreenRecorderApp that isn't nested under
 * (and therefore isn't squeezed by) the screen-recorder tool's sidebar.
 */
export function CutTimeline(): JSX.Element {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const zoom = useTimelineStore((s) => s.timelineZoom);

  const previewUrl = useScreenRecorderStore((s) => s.lastRecording?.previewUrl);
  const panelHeightPx = useScreenRecorderStore((s) => s.timelinePanelHeight);
  const setPanelHeightPx = useScreenRecorderStore((s) => s.setTimelinePanelHeight);
  const loadWaveformForUrl = useWaveformStore((s) => s.loadForUrl);

  // Decoded once per recording (cached in the store, keyed by URL) rather
  // than per-clip -- each ClipPill just slices its own range out of the
  // same peaks array, so re-cutting/reordering never re-decodes audio.
  useEffect(() => {
    if (previewUrl) loadWaveformForUrl(previewUrl);
  }, [previewUrl, loadWaveformForUrl]);

  const {
    startResize,
    isResizing: isEdgeResizing,
    isResizingRef: edgeResizingRef
  } = useEdgeResize();
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRowRef = useRef<HTMLDivElement>(null);

  useAutoGrowPanelHeight({
    trackAreaRef,
    toolbarRowRef,
    minPx: MIN_PANEL_HEIGHT_PX,
    maxPx: MAX_PANEL_HEIGHT_PX,
    chromePx: PANEL_CONTENT_CHROME_PX
  });

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;

  const {
    isCutToolActive,
    isZoomToolActive,
    isPointerToolActive,
    seekFromClientX,
    routeToolClick
  } = useTimelineClickRouter({ trackAreaRef, segments, clampedTotal });

  // Called first (its own ref doesn't depend on hover-scrub) so
  // `playheadDraggingRef` exists for `useHoverScrub`'s gating below --
  // composing the other direction (cancelling a hover baseline when a drag
  // starts) happens after, in the plain `startPlayheadDrag` wrapper.
  const { startPlayheadDrag: startPlayheadDragRaw, playheadDraggingRef } = usePlayheadDrag({
    seekFromClientX
  });

  const {
    effectiveHoverFraction,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    cancelHover
  } = useHoverScrub({
    trackAreaRef,
    segments,
    clampedTotal,
    seekFromClientX,
    playheadDraggingRef,
    edgeResizingRef
  });

  function startPlayheadDrag(event: React.PointerEvent): void {
    cancelHover();
    startPlayheadDragRaw(event);
  }

  // Zoom tool's hover position, mapped to source-ms (the coordinate zoom
  // keyframes are authored in -- see PillTrack.tsx) -- passed down so
  // ZoomTrack can draw its own ghost preview in its own row, following
  // wherever the cursor is over the ruler/clip row above it.
  const zoomPreviewSourceMs =
    isZoomToolActive && effectiveHoverFraction !== null
      ? outputMsToSourceMs(segments, effectiveHoverFraction * clampedTotal)
      : null;

  function handleRulerClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (routeToolClick(event.clientX)) return;
    cancelHover();
    seekFromClientX(event.clientX);
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
        <CutTimelineToolbar ref={toolbarRowRef} />

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
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerUp={handlePointerUp}
          >
            <div className="relative flex flex-col gap-1.5">
              <TimelineRuler
                totalDurationMs={totalDurationMs}
                clampedTotal={clampedTotal}
                isPointerToolActive={isPointerToolActive}
                isCutToolActive={isCutToolActive}
                isZoomToolActive={isZoomToolActive}
                onClick={handleRulerClick}
              />

              <ClipRow
                segments={segments}
                clampedTotal={clampedTotal}
                isEdgeResizing={isEdgeResizing}
                startResize={startResize}
                isPointerToolActive={isPointerToolActive}
                isCutToolActive={isCutToolActive}
                routeToolClick={routeToolClick}
                effectiveHoverFraction={effectiveHoverFraction}
              />
            </div>

            <ZoomTrack previewAtSourceMs={zoomPreviewSourceMs} />
            <CaptionTrack />
            <AnnotationTrack />
            <BlurMaskTrack />

            {effectiveHoverFraction !== null && !isCutToolActive && (
              <HoverScrubMarker leftPercent={effectiveHoverFraction * 100} />
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
