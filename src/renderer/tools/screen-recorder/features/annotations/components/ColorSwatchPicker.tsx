import type { JSX } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover } from '@renderer/components/ui/Popover';
import { cn } from '../../../lib/utils';

/** Shared swatch palette for every annotation color control (arrow shaft, text fill, text background). */
export const ANNOTATION_COLOR_SWATCHES = [
  '#ffffff',
  '#ef4444',
  '#f59e0b',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899'
] as const;

interface ColorSwatchPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  swatches: readonly string[];
  /** Shows a leading "no color" swatch that sets the value to `null` -- used for the text background pill, which defaults to transparent. */
  allowNone?: boolean;
}

/** Compact swatch-dot trigger that opens a popover with the swatch grid + native color input -- shared by every annotation kind that needs a color control (arrow shaft, text fill, text background). */
export function ColorSwatchPicker({
  value,
  onChange,
  swatches,
  allowNone
}: ColorSwatchPickerProps): JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs transition-colors hover:border-accent/40">
        <span
          className={cn(
            'size-4 shrink-0 rounded-full border border-line',
            value === null && 'bg-dotted bg-surface'
          )}
          style={value ? { background: value } : undefined}
        />
        <span className="flex-1 truncate text-left font-medium">
          {value ? value.toUpperCase() : 'None'}
        </span>
        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Content side="bottom" align="start" className="w-56">
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-8 gap-1.5">
            {allowNone && (
              <button
                onClick={() => onChange(null)}
                title="No color"
                aria-label="No color"
                className={cn(
                  'bg-dotted aspect-square rounded-md bg-surface ring-2 ring-offset-2 ring-offset-surface transition-all',
                  value === null ? 'ring-white/80' : 'ring-transparent hover:ring-white/40'
                )}
              />
            )}
            {swatches.map((color) => (
              <button
                key={color}
                onClick={() => onChange(color)}
                title={color}
                aria-label={color}
                className={cn(
                  'aspect-square rounded-md ring-2 ring-offset-2 ring-offset-surface transition-all',
                  value === color ? 'ring-white/80' : 'ring-transparent hover:ring-white/40'
                )}
                style={{ background: color }}
              />
            ))}
          </div>
          <input
            type="color"
            value={value ?? '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
          />
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
