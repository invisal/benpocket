import type { JSX } from 'react';
import type { ClipSpeed, TimelineSegment } from '@screen-recorder/types/timeline';
import { useTimelineStore } from '../store/timeline-store';
import { getSegmentOutputDurationMs } from '../lib/segment-duration';
import { cn } from '../../../lib/utils';

const SPEED_OPTIONS: ClipSpeed[] = [0.5, 1, 1.25, 1.5, 2];

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

/** A number input that only commits on blur/Enter, so mid-typing states don't get clamped away as you type. */
function TimeField({
  label,
  valueMs,
  maxSec,
  disabled,
  onCommit
}: {
  label: string;
  valueMs: number;
  maxSec: number;
  /** Locked once the clip is a cut result (`TimelineSegment.split`) -- see the timeline's own edge-resize handles, which lock the same way. */
  disabled?: boolean;
  onCommit: (ms: number) => void;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={maxSec}
        step={0.1}
        defaultValue={(valueMs / 1000).toFixed(2)}
        key={valueMs}
        disabled={disabled}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(Math.round(next * 1000));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full rounded-md border border-line bg-transparent px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

interface ClipSettingsPanelProps {
  segment: TimelineSegment | null;
}

export function ClipSettingsPanel({ segment }: ClipSettingsPanelProps): JSX.Element {
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  const resizeSegmentEdge = useTimelineStore((s) => s.resizeSegmentEdge);
  const setSegmentSpeed = useTimelineStore((s) => s.setSegmentSpeed);

  if (!segment) {
    return (
      <p className="text-xs text-muted-foreground">Select a clip on the timeline to edit it.</p>
    );
  }

  const outputDurationMs = getSegmentOutputDurationMs(segment);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Trim
        </span>
        <div className="grid grid-cols-2 gap-2">
          <TimeField
            label="Start"
            valueMs={segment.range.startMs}
            maxSec={sourceDurationMs / 1000}
            disabled={segment.split}
            onCommit={(ms) => resizeSegmentEdge(segment.id, 'start', ms)}
          />
          <TimeField
            label="End"
            valueMs={segment.range.endMs}
            maxSec={sourceDurationMs / 1000}
            disabled={segment.split}
            onCommit={(ms) => resizeSegmentEdge(segment.id, 'end', ms)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Plays for {formatTime(outputDurationMs)} at {segment.speed}x
          {segment.speed !== 1
            ? ` (source is ${formatTime(segment.range.endMs - segment.range.startMs)})`
            : ''}
          {segment.split ? ' -- locked, this clip is a cut result' : ''}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Speed
        </span>
        <div className="grid grid-cols-5 gap-1">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => setSegmentSpeed(segment.id, speed)}
              className={cn(
                'rounded-md border py-1.5 text-[11px] font-medium transition-colors',
                segment.speed === speed
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted-foreground hover:border-accent/40'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
