import type { JSX } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Slider } from './slider';

interface SliderRowProps {
  /** Omit for a plain label with no leading icon. */
  icon?: LucideIcon;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** Labeled slider row (icon + label + right-aligned value, slider beneath) -- the layout every settings panel's sliders share, e.g. CursorSettingsPanel's Size/Smoothing/Motion Blur/Click Bounce and BackgroundPicker's Padding/Corner radius/Drop shadow. */
export function SliderRow({
  icon: Icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange
}: SliderRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{displayValue}</span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}
