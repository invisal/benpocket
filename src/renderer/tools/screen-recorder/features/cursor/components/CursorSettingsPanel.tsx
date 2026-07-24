import type { JSX } from 'react';
import { Maximize2, MousePointerClick, Palette, Waves, Wind } from 'lucide-react';
import { useCursorStore } from '../store/cursor-store';
import { Slider } from '../../../components/ui/slider';
import { Switch } from '../../../components/ui/switch';
import { CursorStyleIcon } from './CursorStyleIcon';
import { CURSOR_STYLE_PRESETS } from '@shared/cursor-styles';
import { cn } from '../../../lib/utils';

function SliderRow({
  icon: Icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange
}: {
  icon: typeof Maximize2;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{displayValue}</span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

export function CursorSettingsPanel(): JSX.Element {
  const {
    visible,
    clipToCanvas,
    style,
    size,
    smoothing,
    motionBlur,
    clickBounce,
    setVisible,
    setClipToCanvas,
    setStyle,
    setSize,
    setSmoothing,
    setMotionBlur,
    setClickBounce
  } = useCursorStore();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Show Cursor</span>
          <Switch checked={visible} onChange={setVisible} label="Show cursor" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Clip to Canvas</span>
          <Switch checked={clipToCanvas} onChange={setClipToCanvas} label="Clip cursor to canvas" />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <div className="flex items-center gap-1.5">
          <Palette size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cursor Style
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {CURSOR_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setStyle(preset.id)}
              title={preset.id}
              className={cn(
                'flex items-center justify-center rounded-lg border py-2 transition-colors',
                style === preset.id
                  ? 'border-accent bg-accent/10'
                  : 'border-line hover:border-accent/40'
              )}
            >
              <CursorStyleIcon fill={preset.fill} stroke={preset.stroke} size={18} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-5">
        <SliderRow
          icon={Maximize2}
          label="Size"
          value={size}
          displayValue={size.toFixed(1)}
          min={2}
          max={20}
          step={0.1}
          onChange={setSize}
        />
        <SliderRow
          icon={Waves}
          label="Smoothing"
          value={smoothing}
          displayValue={`${Math.round(smoothing * 100)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={setSmoothing}
        />
        <SliderRow
          icon={Wind}
          label="Motion Blur"
          value={motionBlur}
          displayValue={`${Math.round(motionBlur * 100)}%`}
          min={0}
          max={1}
          step={0.01}
          onChange={setMotionBlur}
        />
        <SliderRow
          icon={MousePointerClick}
          label="Click Bounce"
          value={clickBounce}
          displayValue={clickBounce.toFixed(1)}
          min={0}
          max={5}
          step={0.1}
          onChange={setClickBounce}
        />
      </div>
    </div>
  );
}
