import type { JSX } from 'react';
import { formatTime, pickMajorTickIntervalMs } from '../lib/timeline-format';
import { cn } from '../../../lib/utils';

interface TimelineRulerProps {
  totalDurationMs: number;
  clampedTotal: number;
  isPointerToolActive: boolean;
  isCutToolActive: boolean;
  isZoomToolActive: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/** Tick marks along the top of the track stack -- major ticks (with a time label) every third minor tick. */
export function TimelineRuler({
  totalDurationMs,
  clampedTotal,
  isPointerToolActive,
  isCutToolActive,
  isZoomToolActive,
  onClick
}: TimelineRulerProps): JSX.Element {
  const majorTickIntervalMs = pickMajorTickIntervalMs(totalDurationMs);
  const minorTickIntervalMs = majorTickIntervalMs / 3;
  const tickCount = totalDurationMs > 0 ? Math.floor(totalDurationMs / minorTickIntervalMs) + 1 : 0;
  const ticks = Array.from({ length: tickCount }, (_, i) => ({
    atMs: i * minorTickIntervalMs,
    major: i % 3 === 0
  }));

  return (
    <div
      onClick={onClick}
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
  );
}
