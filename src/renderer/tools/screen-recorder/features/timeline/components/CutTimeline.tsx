import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Clapperboard, Trash2 } from 'lucide-react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { useTimelineStore } from '../store/timeline-store';
import { getSegmentOutputDurationMs, outputMsToSourceMs } from '../lib/segment-duration';
import { useEdgeResize } from '../lib/use-edge-resize';
import { useSegmentReorderDrag } from '../lib/use-segment-reorder-drag';
import { ZoomTrack } from '../../zoom/components/ZoomTrack';
import { CropTrack } from '../../crop/components/CropTrack';
import { CaptionTrack } from '../../captions/components/CaptionTrack';
import { TrimTrack } from './TrimTrack';
import { SpeedTrack } from './SpeedTrack';
import { Playhead } from './Playhead';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

interface PanelResize {
  startClientY: number;
  startHeightPx: number;
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
  const splitAt = useTimelineStore((s) => s.splitAt);
  const deleteSegment = useTimelineStore((s) => s.deleteSegment);
  const resizeSegmentEdge = useTimelineStore((s) => s.resizeSegmentEdge);

  const { dragOverIndex, getDragHandlers } = useSegmentReorderDrag();
  const { startResize } = useEdgeResize();
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const playheadDraggingRef = useRef(false);

  // Panel height is self-managed (not lifted to EditorPage) so the timeline
  // is an independently resizable strip spanning the full editor width.
  const [panelHeightPx, setPanelHeightPx] = useState(DEFAULT_PANEL_HEIGHT_PX);
  const panelResizeRef = useRef<PanelResize | null>(null);

  const totalDurationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
  const clampedTotal = totalDurationMs > 0 ? totalDurationMs : 1;

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
    seekFromClientX(event.clientX);
    window.addEventListener('pointermove', handlePlayheadDragMove);
    window.addEventListener('pointerup', stopPlayheadDrag, { once: true });
  }

  function handleRulerClick(event: React.MouseEvent<HTMLDivElement>): void {
    seekFromClientX(event.clientX);
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
        <div className="flex shrink-0 items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <Clapperboard size={12} /> {segments.length} clip{segments.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
            {formatTime(totalDurationMs)} total
          </span>
          <span className="ml-auto text-white/30">
            Click to select · double-click to split · drag to reorder, trim, or scrub
          </span>
        </div>

        {/*
          Every track (ruler, clips, Zoom/Caption/Speed/Crop pills) lives
          inside this one zoom-scaled, horizontally-scrolling container so
          they share a single coordinate space -- percentages computed
          against `clampedTotal` line up across rows at any zoom level or
          scroll position, and the playhead (last child, absolutely
          positioned) spans the full stack instead of just the ruler.
        */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div
            ref={trackAreaRef}
            className="relative flex flex-col gap-1.5"
            style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
          >
            <div
              onClick={handleRulerClick}
              title="Click to scrub"
              className="relative h-5 shrink-0 cursor-pointer select-none mx-3"
            >
              {ticks.map(({ atMs, major }) => (
                <div
                  key={atMs}
                  className="pointer-events-none absolute top-0"
                  style={{ left: `${(atMs / clampedTotal) * 100}%` }}
                >
                  <div className={cn('w-px bg-white/25', major ? 'h-2' : 'h-1')} />
                  {major && (
                    <span className="absolute left-0 top-2 -translate-x-1/2 whitespace-nowrap text-[9px] text-white/40">
                      {formatTime(atMs)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/*
              Deliberately neutral (not red/Scissors) since those now belong
              to TrimTrack's sparse "this clip was trimmed" indicator below --
              this row always shows every clip, tiled edge-to-edge, which is
              a different thing from that indicator.
            */}
            <div className="flex h-9 shrink-0 items-center gap-0.5 px-1">
              {segments.map((segment, index) => {
                const widthPercent = (getSegmentOutputDurationMs(segment) / clampedTotal) * 100;
                const isSelected = selectedSegmentId === segment.id;
                return (
                  <div
                    key={segment.id}
                    {...getDragHandlers(index)}
                    onClick={() => setSelectedSegmentId(segment.id)}
                    onDoubleClick={(e) => handleDoubleClick(segment, index, e)}
                    className={cn(
                      'group relative flex h-7 min-w-9 cursor-grab items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/10 active:cursor-grabbing',
                      dragOverIndex === index && 'ring-2 ring-accent',
                      dragOverIndex !== index && isSelected && 'ring-2 ring-white/70'
                    )}
                    style={{ width: `${widthPercent}%` }}
                  >
                    <div className="pointer-events-none flex items-center gap-1.5 px-2 text-white/80">
                      <Clapperboard size={13} className="shrink-0" />
                      <span className="truncate text-[11px] font-medium">
                        {formatTime(getSegmentOutputDurationMs(segment))}
                      </span>
                      {segment.speed !== 1 && (
                        <span className="shrink-0 text-[10px] text-white/50">{segment.speed}x</span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSegment(segment.id);
                      }}
                      disabled={segments.length <= 1}
                      className="absolute right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white/70 hover:text-red-400 disabled:opacity-30 group-hover:flex"
                    >
                      <Trash2 size={11} />
                    </button>

                    <div
                      onPointerDown={(e) => {
                        const width =
                          e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                        startResizeHandler(segment, 'start', width)(e);
                      }}
                      className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/15 hover:bg-white/30"
                    />
                    <div
                      onPointerDown={(e) => {
                        const width =
                          e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                        startResizeHandler(segment, 'end', width)(e);
                      }}
                      className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/15 hover:bg-white/30"
                    />
                  </div>
                );
              })}
            </div>

            <ZoomTrack />
            <TrimTrack />
            <CaptionTrack />
            <SpeedTrack />
            <CropTrack />

            <Playhead
              segments={segments}
              clampedTotal={clampedTotal}
              onPointerDown={startPlayheadDrag}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
