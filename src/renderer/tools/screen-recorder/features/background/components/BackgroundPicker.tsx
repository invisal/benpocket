import type { JSX } from 'react';
import { useRef } from 'react';
import { WALLPAPER_PRESETS, cssGradient } from '@shared/wallpaper-presets';
import { PHOTO_PRESETS } from '../lib/photo-presets';
import { useBackgroundStore } from '../store/background-store';
import { Slider } from '../../../components/ui/slider';
import { Button } from '@renderer/components/ui/Button';
import { cn } from '../../../lib/utils';

const GRADIENT_PRESETS: { angleDeg: number; colors: [string, string] }[] = [
  { angleDeg: 135, colors: ['#22c55e', '#0ea5e9'] },
  { angleDeg: 135, colors: ['#f97316', '#ec4899'] },
  { angleDeg: 135, colors: ['#8b5cf6', '#ec4899'] },
  { angleDeg: 135, colors: ['#0ea5e9', '#6366f1'] },
  { angleDeg: 135, colors: ['#111827', '#374151'] }
];

const COLOR_SWATCHES = [
  '#0f0f12',
  '#111827',
  '#1f2937',
  '#052e2b',
  '#1e1b4b',
  '#3f0f1a',
  '#0c4a6e',
  '#ffffff'
];

const TABS: { id: 'wallpaper' | 'gradient' | 'color' | 'image'; label: string }[] = [
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'color', label: 'Color' },
  { id: 'image', label: 'Image' }
];

function swatchClass(isSelected: boolean): string {
  return cn(
    'aspect-square rounded-lg ring-2 ring-offset-2 ring-offset-surface transition-all',
    isSelected ? 'ring-white/80' : 'ring-transparent hover:ring-white/40'
  );
}

/** Parses/serializes the "angleDeg|color1|color2" `value` shape used for kind='gradient'. */
function parseGradientValue(value: string): { angleDeg: number; color1: string; color2: string } {
  const [angleDeg = '135', color1 = '#22c55e', color2 = '#0ea5e9'] = value.split('|');
  return { angleDeg: Number(angleDeg) || 135, color1, color2 };
}

export function BackgroundPicker(): JSX.Element {
  const {
    kind,
    value,
    padding,
    blur,
    cornerRadius,
    shadow,
    setKind,
    setValue,
    setPadding,
    setBlur,
    setCornerRadius,
    setShadow
  } = useBackgroundStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValue(reader.result);
        setKind('image');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  const gradient = kind === 'gradient' ? parseGradientValue(value) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setKind(tab.id)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                kind === tab.id
                  ? 'bg-surface-2 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {kind === 'wallpaper' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Wallpaper
          </span>
          <div className="grid grid-cols-4 gap-2">
            {WALLPAPER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setValue(preset.id)}
                title={preset.label}
                aria-label={preset.label}
                className={swatchClass(value === preset.id)}
                style={{ background: cssGradient(preset) }}
              />
            ))}
          </div>
        </div>
      )}

      {kind === 'gradient' && gradient && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Gradient
          </span>
          <div className="grid grid-cols-5 gap-2">
            {GRADIENT_PRESETS.map((preset, i) => {
              const presetValue = `${preset.angleDeg}|${preset.colors[0]}|${preset.colors[1]}`;
              return (
                <button
                  key={i}
                  onClick={() => setValue(presetValue)}
                  className={swatchClass(value === presetValue)}
                  style={{
                    background: `linear-gradient(${preset.angleDeg}deg, ${preset.colors[0]}, ${preset.colors[1]})`
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={gradient.color1}
              onChange={(e) =>
                setValue(`${gradient.angleDeg}|${e.target.value}|${gradient.color2}`)
              }
              className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
            />
            <input
              type="color"
              value={gradient.color2}
              onChange={(e) =>
                setValue(`${gradient.angleDeg}|${gradient.color1}|${e.target.value}`)
              }
              className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Angle · {gradient.angleDeg}°</span>
            <Slider
              value={gradient.angleDeg}
              min={0}
              max={359}
              step={1}
              onChange={(angleDeg) => setValue(`${angleDeg}|${gradient.color1}|${gradient.color2}`)}
            />
          </div>
        </div>
      )}

      {kind === 'color' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Color
          </span>
          <div className="grid grid-cols-8 gap-2">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                onClick={() => setValue(color)}
                className={cn(swatchClass(value === color), 'border border-border-dark')}
                style={{ background: color }}
              />
            ))}
          </div>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0f0f12'}
            onChange={(e) => setValue(e.target.value)}
            className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
          />
        </div>
      )}

      {kind === 'image' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Image
          </span>
          {value && (
            <div className="aspect-video overflow-hidden rounded-lg border border-line">
              <img src={value} alt="Background" className="h-full w-full object-cover" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Choose image…
          </Button>

          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Photo presets
          </span>
          <div className="grid grid-cols-4 gap-2">
            {PHOTO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setValue(preset.src)}
                title={preset.label}
                aria-label={preset.label}
                className={cn(swatchClass(value === preset.src), 'bg-cover bg-center')}
                style={{ backgroundImage: `url(${preset.src})` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Background blur
          </span>
          <span className="text-xs text-muted-foreground">{blur}px</span>
        </div>
        <Slider value={blur} min={0} max={20} step={1} onChange={setBlur} />
        {kind !== 'image' && (
          <p className="text-[11px] text-muted-foreground/70">
            Only affects Image backgrounds -- gradients have nothing to blur.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Padding
          </span>
          <span className="text-xs text-muted-foreground">{padding}%</span>
        </div>
        <Slider value={padding} min={0} max={30} step={1} onChange={setPadding} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Corner radius
          </span>
          <span className="text-xs text-muted-foreground">{cornerRadius}px</span>
        </div>
        <Slider value={cornerRadius} min={0} max={40} step={1} onChange={setCornerRadius} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Drop shadow
          </span>
          <span className="text-xs text-muted-foreground">{shadow}</span>
        </div>
        <Slider value={shadow} min={0} max={100} step={1} onChange={setShadow} />
      </div>
    </div>
  );
}
