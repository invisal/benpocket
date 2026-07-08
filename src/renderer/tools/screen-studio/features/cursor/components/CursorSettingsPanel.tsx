import type { JSX } from 'react';
import { useCursorStore } from '../store/cursor-store';
import { Slider } from '../../../components/ui/slider';
import { cn } from '../../../lib/utils';

const THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'pointer', label: 'Pointer' },
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'dot', label: 'Dot' }
];

const CLICK_EFFECTS: { id: 'none' | 'ripple' | 'highlight'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'ripple', label: 'Ripple' },
  { id: 'highlight', label: 'Highlight' }
];

export function CursorSettingsPanel(): JSX.Element {
  const { theme, size, smoothing, clickEffect, setTheme, setSize, setSmoothing, setClickEffect } =
    useCursorStore();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Cursor theme
        </span>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                theme === option.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-white/60 hover:border-white/20'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">Size</span>
          <span className="text-xs text-white/50">{size.toFixed(1)}×</span>
        </div>
        <Slider value={size} min={0.5} max={3} step={0.1} onChange={setSize} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Smoothing
          </span>
          <span className="text-xs text-white/50">{Math.round(smoothing * 100)}%</span>
        </div>
        <Slider value={smoothing} min={0} max={1} step={0.05} onChange={setSmoothing} />
        <p className="text-[11px] text-white/30">
          Smooths out jittery mouse movement after recording.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Click effect
        </span>
        <div className="grid grid-cols-3 gap-2">
          {CLICK_EFFECTS.map((option) => (
            <button
              key={option.id}
              onClick={() => setClickEffect(option.id)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                clickEffect === option.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-white/60 hover:border-white/20'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
