import { forwardRef, type JSX } from 'react';
import { Clapperboard, Minus, Plus, Redo2, Scissors, Undo2, ZoomIn } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useHistoryStore } from '../../history/store/history-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM
} from '../store/timeline-store';
import { cn } from '../../../lib/utils';
import { Slider } from '../../../components/ui/slider';

/**
 * Undo/redo, the cut/zoom tool toggles, the clip-count readout, and the
 * timeline zoom slider -- fully self-contained (reads its own stores
 * directly, same as ZoomTrack/CaptionTrack/etc.), so CutTimeline just
 * renders it and measures its height for the auto-grow panel effect (hence
 * accepting `ref` directly, rather than this needing to be prop-drilled).
 */
export const CutTimelineToolbar = forwardRef<HTMLDivElement>(
  function CutTimelineToolbar(_props, ref): JSX.Element {
    const segmentCount = useTimelineStore(
      (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments.length ?? 0
    );
    const zoom = useTimelineStore((s) => s.timelineZoom);
    const setTimelineZoom = useTimelineStore((s) => s.setTimelineZoom);
    const isCutToolActive = useTimelineStore((s) => s.isCutToolActive);
    const setCutToolActive = useTimelineStore((s) => s.setCutToolActive);
    const isZoomToolActive = useTimelineStore((s) => s.isZoomToolActive);
    const setZoomToolActive = useTimelineStore((s) => s.setZoomToolActive);
    const canUndo = useHistoryStore((s) => s.past.length > 0);
    const canRedo = useHistoryStore((s) => s.future.length > 0);
    const undo = useHistoryStore((s) => s.undo);
    const redo = useHistoryStore((s) => s.redo);

    return (
      <div ref={ref} className="flex shrink-0 items-center gap-1">
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
              <Clapperboard size={12} /> {segmentCount} clip{segmentCount === 1 ? '' : 's'}
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
    );
  }
);
