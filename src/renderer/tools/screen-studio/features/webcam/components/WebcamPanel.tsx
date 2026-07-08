import type { JSX } from 'react';
import { Circle, Square, SquareUser } from 'lucide-react';
import { useWebcamStore } from '../store/webcam-store';
import { Slider } from '../../../components/ui/slider';
import { cn } from '../../../lib/utils';

const SHAPES: { id: 'circle' | 'rounded-square' | 'square'; label: string; icon: typeof Circle }[] =
  [
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'rounded-square', label: 'Rounded', icon: SquareUser },
    { id: 'square', label: 'Square', icon: Square }
  ];

/**
 * Richer webcam PiP panel for the Editor page -- covers everything
 * `WebcamShapePicker` (used on the Record setup page) doesn't: enable
 * toggle, size, and drag-to-position via the preview overlay
 * (`PreviewStage`'s draggable PiP), whose live x/y land here too so both can
 * edit the same `webcam-store` state.
 */
export function WebcamPanel(): JSX.Element {
  const {
    enabled,
    shape,
    mirrored,
    size,
    position,
    toggleEnabled,
    setShape,
    setMirrored,
    setSize,
    setPosition
  } = useWebcamStore();

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between">
        <span className="text-xs font-medium">Webcam overlay</span>
        <button
          onClick={toggleEnabled}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            enabled ? 'bg-accent' : 'bg-white/15'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </label>

      <div className={cn('flex flex-col gap-4', !enabled && 'pointer-events-none opacity-40')}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">Shape</span>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setShape(option.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                    shape === option.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-white/60 hover:border-white/20'
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-white/40">Mirror</span>
          <input
            type="checkbox"
            checked={mirrored}
            onChange={(e) => setMirrored(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">Size</span>
            <span className="text-xs text-white/50">{size}px</span>
          </div>
          <Slider value={size} min={80} max={360} step={4} onChange={setSize} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">X</span>
            <input
              type="number"
              value={Math.round(position.x)}
              onChange={(e) => setPosition({ ...position, x: Number(e.target.value) })}
              className="rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">Y</span>
            <input
              type="number"
              value={Math.round(position.y)}
              onChange={(e) => setPosition({ ...position, y: Number(e.target.value) })}
              className="rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <p className="text-[11px] text-white/30">Or drag the PiP directly on the preview above.</p>
      </div>
    </div>
  );
}
