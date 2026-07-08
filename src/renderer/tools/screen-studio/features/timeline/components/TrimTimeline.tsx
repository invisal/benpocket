import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

export interface TrimTimelineProps {
  durationSeconds: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Deterministic fake waveform -- there's no decoded audio track to draw a
// real one from yet (see features/timeline/components/AudioWaveform.tsx's
// TODO). This just gives the trim bar something textured to grab onto.
function fakeWaveformHeights(count: number): number[] {
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i * 0.4) * 0.3 + Math.sin(i * 0.13) * 0.2;
    heights.push(0.25 + Math.abs(wave));
  }
  return heights;
}

const BAR_COUNT = 90;

export function TrimTimeline({
  durationSeconds,
  start,
  end,
  onChange
}: TrimTimelineProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const bars = useMemo(() => fakeWaveformHeights(BAR_COUNT), []);

  const clampedDuration = durationSeconds > 0 ? durationSeconds : 1;
  const startPct = (start / clampedDuration) * 100;
  const endPct = (end / clampedDuration) * 100;

  const positionToSeconds = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return fraction * clampedDuration;
    },
    [clampedDuration]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging) return;
      const seconds = positionToSeconds(event.clientX);
      if (dragging === 'start') onChange(Math.min(seconds, end - 0.5), end);
      else onChange(start, Math.max(seconds, start + 0.5));
    },
    [dragging, end, onChange, positionToSeconds, start]
  );

  const stopDragging = useCallback(() => {
    setDragging(null);
    window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  const startDragging =
    (handle: 'start' | 'end') =>
    (event: React.PointerEvent): void => {
      event.preventDefault();
      setDragging(handle);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopDragging, { once: true });
    };

  return (
    <div className="flex flex-col gap-2 border-t border-line bg-surface-raised px-4 py-3">
      <div className="flex items-center gap-3 text-xs text-white/50">
        <span>
          Trim {formatTime(start)} → {formatTime(end)}
        </span>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
          {formatTime(end - start)} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* TODO: zoom control is decorative -- wire it to actually
              rescale BAR_COUNT/track width once the timeline needs to
              handle recordings long enough that per-second precision matters. */}
          <span>−</span>
          <input type="range" min={0} max={100} defaultValue={60} className="w-24 accent-accent" />
          <span>+</span>
        </div>
      </div>

      <div ref={trackRef} className="relative h-14 select-none rounded-lg bg-black/30">
        <div className="absolute inset-0 flex items-center gap-[2px] overflow-hidden px-1">
          {bars.map((height, index) => {
            const barPct = (index / BAR_COUNT) * 100;
            const inSelection = barPct >= startPct && barPct <= endPct;
            return (
              <div
                key={index}
                className={inSelection ? 'bg-accent/70' : 'bg-white/15'}
                style={{ height: `${height * 100}%`, width: `${100 / BAR_COUNT}%` }}
              />
            );
          })}
        </div>

        <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${startPct}%` }} />
        <div
          className="absolute inset-y-0 right-0 bg-black/60"
          style={{ width: `${100 - endPct}%` }}
        />

        <div
          onPointerDown={startDragging('start')}
          className="absolute inset-y-0 w-2 -translate-x-1/2 cursor-ew-resize rounded-full bg-accent"
          style={{ left: `${startPct}%` }}
        />
        <div
          onPointerDown={startDragging('end')}
          className="absolute inset-y-0 w-2 -translate-x-1/2 cursor-ew-resize rounded-full bg-accent"
          style={{ left: `${endPct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-white/30">
        <span>0:00</span>
        <span>{formatTime(clampedDuration)}</span>
      </div>
    </div>
  );
}
