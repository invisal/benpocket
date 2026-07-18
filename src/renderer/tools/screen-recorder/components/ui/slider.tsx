import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { beginGesture, endGesture } from '../../features/history/store/history-store';
import { cn } from '../../lib/utils';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ value, min, max, step, onChange, className }: SliderProps): JSX.Element {
  // A pointer-drag scrub fires `onChange` once per pixel of movement; treat
  // the whole drag as one undo step instead of one per tick. Keyboard-driven
  // changes (arrow keys while focused) skip this entirely -- there's no
  // pointerdown for those, so each keypress stays its own undo step.
  const isDraggingRef = useRef(false);

  const endDragGesture = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    endGesture();
  }, []);

  // Guards against the pointerup listener never firing (this slider
  // unmounts mid-drag, e.g. the panel it's in gets closed) -- otherwise the
  // gesture it opened would stay open forever, silently swallowing every
  // undo-tracked change made afterward.
  useEffect(() => endDragGesture, [endDragGesture]);

  function handlePointerDown(): void {
    isDraggingRef.current = true;
    beginGesture();
    window.addEventListener('pointerup', endDragGesture, { once: true });
  }

  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={handlePointerDown}
      className={cn(
        'h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent',
        className
      )}
    />
  );
}
