import type { JSX } from 'react';
import { type RefObject } from 'react';
import {
  ChevronDown,
  Crop,
  Minus,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  SkipForward,
  Undo2,
  ZoomIn
} from 'lucide-react';
import type { AspectRatio } from '@screen-recorder/types/export';
import { useExportStore } from '../../features/export/store/export-store';
import { useHistoryStore } from '../../features/history/store/history-store';
import {
  useTimelineStore,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM
} from '../../features/timeline/store/timeline-store';
import { useZoomStore } from '../../features/zoom/store/zoom-store';
import { cn } from '../../lib/utils';

const ASPECT_LABELS: Record<AspectRatio, string> = {
  '16:9': 'Wide 16:9',
  '9:16': 'Vertical 9:16',
  '1:1': 'Square 1:1',
  '4:3': 'Standard 4:3'
};

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface EditorTransportBarProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  cropToolActive: boolean;
  onToggleCrop: () => void;
  onSplitSelected: () => void;
  canSplitSelected: boolean;
  /** Current playback position, ms, source-relative -- for the "0:12 / 1:34" readout. */
  currentTimeMs: number;
  /** Full source duration, ms -- 0 before metadata loads (readout just shows "0:00" for the total then). */
  durationMs: number;
}

export function EditorTransportBar({
  videoRef,
  isPlaying,
  cropToolActive,
  onToggleCrop,
  onSplitSelected,
  canSplitSelected,
  currentTimeMs,
  durationMs
}: EditorTransportBarProps): JSX.Element {
  const aspectRatio = useExportStore((s) => s.aspectRatio);
  const setAspectRatio = useExportStore((s) => s.setAspectRatio);
  const timelineZoom = useTimelineStore((s) => s.timelineZoom);
  const setTimelineZoom = useTimelineStore((s) => s.setTimelineZoom);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const addZoomKeyframe = useZoomStore((s) => s.addKeyframe);
  const setSelectedZoomKeyframeId = useZoomStore((s) => s.setSelectedKeyframeId);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  // Drops a keyframe at the playhead with the default 'auto-cursor' target --
  // no arm-and-click-the-preview step first, unlike the "Add keyframe"
  // button in ZoomKeyframeEditor -- then opens the Zoom panel on it so it's
  // immediately ready to tweak.
  function addZoomKeyframeHere(): void {
    const id = addZoomKeyframe(currentTimeMs);
    setSelectedZoomKeyframeId(id);
    setActiveTool('zoom');
  }

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  return (
    <div className="flex shrink-0 items-center gap-3 px-6 pb-3 text-white/70">
      <div className="relative">
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
          className="appearance-none rounded-lg border border-line bg-surface-raised py-1.5 pl-3 pr-7 text-xs font-medium text-white/80"
        >
          {(Object.keys(ASPECT_LABELS) as AspectRatio[]).map((ratio) => (
            <option key={ratio} value={ratio}>
              {ASPECT_LABELS[ratio]}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <button
        onClick={onToggleCrop}
        title="Toggle crop tool"
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          cropToolActive
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-line text-white/60 hover:border-white/20'
        )}
      >
        <Crop size={13} /> Crop
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
          title="Jump to start"
        >
          <SkipBack size={15} />
        </button>
        <button
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          onClick={() =>
            videoRef.current && (videoRef.current.currentTime = videoRef.current.duration || 0)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
          title="Jump to end"
        >
          <SkipForward size={15} />
        </button>
      </div>

      <span className="font-mono text-xs tabular-nums text-white/50">
        {formatTime(currentTimeMs)} / {formatTime(durationMs)}
      </span>

      <button
        onClick={onSplitSelected}
        disabled={!canSplitSelected}
        title="Split the selected clip at its midpoint"
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
      >
        <Scissors size={14} />
      </button>

      <button
        onClick={addZoomKeyframeHere}
        title="Add a zoom keyframe at the playhead"
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
      >
        <ZoomIn size={14} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setTimelineZoom(Math.max(MIN_TIMELINE_ZOOM, timelineZoom - 0.5))}
          title="Zoom out timeline"
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <Minus size={13} />
        </button>
        <input
          type="range"
          min={MIN_TIMELINE_ZOOM}
          max={MAX_TIMELINE_ZOOM}
          step={0.5}
          value={timelineZoom}
          onChange={(e) => setTimelineZoom(Number(e.target.value))}
          title="Timeline zoom"
          className="w-24 accent-accent"
        />
        <button
          onClick={() => setTimelineZoom(Math.min(MAX_TIMELINE_ZOOM, timelineZoom + 0.5))}
          title="Zoom in timeline"
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
