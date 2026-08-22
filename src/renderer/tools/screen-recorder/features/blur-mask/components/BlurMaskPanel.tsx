import type { JSX } from 'react';
import { Droplets, Square, Timer, Trash2 } from 'lucide-react';
import type { BlurMaskRegion } from '@screen-recorder/types/project';
import { useBlurMaskStore, MIN_BLUR_INTENSITY, MAX_BLUR_INTENSITY } from '../store/blur-mask-store';
import { selectBlurMaskRegion } from '../../../store/selection-coordinator';
import { SliderRow } from '../../../components/ui/slider-row';
import { Button } from '@renderer/components/ui/Button';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

const MIN_DURATION_MS = 300;
const MAX_DURATION_MS = 15000;

const SHAPES: { id: BlurMaskRegion['shape']; label: string }[] = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' }
];

const MASK_COLOR_SWATCHES = ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#ec4899'];

function regionLabel(region: BlurMaskRegion): string {
  return region.kind === 'blur' ? 'Blur' : 'Mask';
}

interface BlurMaskPanelProps {
  /** Current preview position (ms, source-relative) -- "Add" targets this. */
  currentTimeMs: number;
}

export function BlurMaskPanel({ currentTimeMs }: BlurMaskPanelProps): JSX.Element {
  const regions = useBlurMaskStore((s) => s.regions);
  const selectedRegionId = useBlurMaskStore((s) => s.selectedRegionId);
  const addBlurRegion = useBlurMaskStore((s) => s.addBlurRegion);
  const addMaskRegion = useBlurMaskStore((s) => s.addMaskRegion);
  const removeRegion = useBlurMaskStore((s) => s.removeRegion);
  const updateRegion = useBlurMaskStore((s) => s.updateRegion);

  const sorted = [...regions].sort((a, b) => a.atMs - b.atMs);
  const selected = sorted.find((r) => r.id === selectedRegionId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => addBlurRegion(currentTimeMs)}
          className="flex flex-col items-center gap-1 py-2 text-sm"
        >
          <Droplets size={14} /> Blur
        </Button>
        <Button
          variant="secondary"
          onClick={() => addMaskRegion(currentTimeMs)}
          className="flex flex-col items-center gap-1 py-2 text-sm"
        >
          <Square size={14} /> Mask
        </Button>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No blur/mask regions yet.</p>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-col gap-1">
          {sorted.map((region) => {
            const Icon = region.kind === 'blur' ? Droplets : Square;
            return (
              <button
                key={region.id}
                onClick={() => selectBlurMaskRegion(region.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors',
                  selectedRegionId === region.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line text-muted-foreground hover:border-accent/40'
                )}
              >
                <Icon size={13} className="shrink-0" />
                <span className="flex-1 truncate">{regionLabel(region)}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatTime(region.atMs)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {regionLabel(selected)}
            </span>
            <button
              onClick={() => removeRegion(selected.id)}
              className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Shape</span>
            <div className="grid grid-cols-2 gap-1.5">
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => updateRegion(selected.id, { shape: shape.id })}
                  className={cn(
                    'rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                    selected.shape === shape.id
                      ? 'border-accent text-accent'
                      : 'border-line text-muted-foreground hover:border-accent/40'
                  )}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>

          {selected.kind === 'blur' && (
            <SliderRow
              icon={Droplets}
              label="Intensity"
              value={selected.intensity}
              displayValue={`${selected.intensity}`}
              min={MIN_BLUR_INTENSITY}
              max={MAX_BLUR_INTENSITY}
              step={1}
              onChange={(intensity) => updateRegion(selected.id, { intensity })}
            />
          )}

          {selected.kind === 'mask' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground">Color</span>
              <div className="grid grid-cols-6 gap-1.5">
                {MASK_COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateRegion(selected.id, { color })}
                    title={color}
                    aria-label={color}
                    className={cn(
                      'aspect-square rounded-md ring-2 ring-offset-2 ring-offset-surface transition-all',
                      selected.color === color
                        ? 'ring-white/80'
                        : 'ring-transparent hover:ring-white/40'
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={selected.color}
                onChange={(e) => updateRegion(selected.id, { color: e.target.value })}
                className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
              />
            </div>
          )}

          <SliderRow
            icon={Timer}
            label="Duration"
            value={selected.durationMs}
            displayValue={`${(selected.durationMs / 1000).toFixed(1)}s`}
            min={MIN_DURATION_MS}
            max={MAX_DURATION_MS}
            step={100}
            onChange={(durationMs) => updateRegion(selected.id, { durationMs })}
          />
        </div>
      )}
    </div>
  );
}
