import type { JSX } from 'react';
import { type RefObject } from 'react';
import { Crop, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { AspectRatio } from '@screen-recorder/types/export';
import type { PreviewVideoController } from '@screen-recorder/types/editor';
import { Select } from '@renderer/components/ui/Select';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useExportStore } from '../../features/export/store/export-store';
import { cn } from '../../lib/utils';
import { ASPECT_LABELS } from './editorTools';
import { Button } from '@renderer/components/ui/Button';

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface EditorTransportBarProps {
  videoRef: RefObject<PreviewVideoController | null>;
  isPlaying: boolean;
  /** Whether the selected clip already has a crop applied -- highlights the button so it's clear cropping is active for this clip, even with the dialog closed. */
  hasCrop: boolean;
  onOpenCrop: () => void;
  /** Current playback position, ms, source-relative -- for the "0:12 / 1:34" readout. */
  currentTimeMs: number;
  /** Full source duration, ms -- 0 before metadata loads (readout just shows "0:00" for the total then). */
  durationMs: number;
}

export function EditorTransportBar({
  videoRef,
  isPlaying,
  hasCrop,
  onOpenCrop,
  currentTimeMs,
  durationMs
}: EditorTransportBarProps): JSX.Element {
  const aspectRatio = useExportStore((s) => s.aspectRatio);
  const setAspectRatio = useExportStore((s) => s.setAspectRatio);

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  return (
    <div className="flex shrink-0 items-center gap-3 px-6 pb-3 text-muted-foreground">
      <Select.Root
        value={aspectRatio}
        onValueChange={(value) => setAspectRatio(value as AspectRatio)}
      >
        <Select.Trigger size="sm">{ASPECT_LABELS[aspectRatio]}</Select.Trigger>
        <Select.Content>
          {(Object.keys(ASPECT_LABELS) as AspectRatio[]).map((ratio) => (
            <Select.Item key={ratio} value={ratio}>
              {ASPECT_LABELS[ratio]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>

      <Button
        onClick={onOpenCrop}
        title="Crop this clip"
        variant="outline"
        size="sm"
        className={cn(hasCrop && 'border-accent bg-accent/10 text-accent')}
      >
        <Crop size={13} /> Crop
      </Button>

      <div className="flex items-center gap-1">
        <button
          onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2"
          title="Jump to start"
        >
          <SkipBack size={15} />
        </button>
        <Tooltip.Provider delay={300} closeDelay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <button
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2"
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>
              }
            />
            <Tooltip.Content>
              <span className="flex items-center gap-1">
                {isPlaying ? 'Pause' : 'Play'} (Space)
              </span>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <button
          onClick={() =>
            videoRef.current && (videoRef.current.currentTime = videoRef.current.duration || 0)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2"
          title="Jump to end"
        >
          <SkipForward size={15} />
        </button>
      </div>

      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(currentTimeMs)} / {formatTime(durationMs)}
      </span>
    </div>
  );
}
