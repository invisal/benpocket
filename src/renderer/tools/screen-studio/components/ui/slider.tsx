import type { JSX } from 'react';
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
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent',
        className
      )}
    />
  );
}
