import type { JSX } from 'react';
import {
  Captions,
  Circle,
  Crop,
  Droplets,
  MousePointer2,
  MoveUpRight,
  Redo2,
  Square,
  Squircle,
  Tag,
  Type,
  Undo2
} from 'lucide-react';
import { cn } from 'cnfast';
import { Input } from '@renderer/components/ui/Input';
import { Popover } from '@renderer/components/ui/Popover';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { FONT_TIERS, MAX_CORNER_RADIUS_UNITS, useCaptureEditorStore } from '../store/editor.store';
import type { EditorTool } from '../types/editor';

/**
 * Unlike stage tools, a chip has a fixed default spot (image top-left), so
 * the rail button places it immediately — no placement click. Defaults:
 * white text, biggest font tier; edit via the layer's properties dropdown.
 */
function addChip(): void {
  const s = useCaptureEditorStore.getState();
  s.setTool('select');
  s.addAnnotation({
    id: crypto.randomUUID(),
    kind: 'chip',
    x: 16 * s.unit,
    y: 16 * s.unit,
    text: 'Before',
    color: '#ffffff',
    fontSize: FONT_TIERS.at(-1)!.value * s.unit
  });
}

// 'chip' is an action button (adds a text label immediately), not a stage tool.
const TOOLS: { id: EditorTool | 'chip'; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'chip', label: 'Text label', icon: Captions },
  { id: 'label', label: 'Numbered label', icon: Tag },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { id: 'blur', label: 'Blur', icon: Droplets },
  { id: 'crop', label: 'Crop', icon: Crop }
];

function railButtonClass(active: boolean): string {
  return cn(
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors',
    'disabled:pointer-events-none disabled:opacity-40',
    active ? 'bg-surface-4 text-accent' : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
  );
}

function RailTooltip({
  label,
  children
}: {
  label: string;
  children: React.ReactElement;
}): JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Content side="right">{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}

/** Vertical tool rail on the left edge of the editor stage. */
export function EditorToolbar(): JSX.Element {
  const tool = useCaptureEditorStore((s) => s.tool);
  const setTool = useCaptureEditorStore((s) => s.setTool);
  const cornerRadius = useCaptureEditorStore((s) => s.cornerRadius);
  const setCornerRadius = useCaptureEditorStore((s) => s.setCornerRadius);
  const unit = useCaptureEditorStore((s) => s.unit);
  const canUndo = useCaptureEditorStore((s) => s.past.length > 0);
  const canRedo = useCaptureEditorStore((s) => s.future.length > 0);
  const undo = useCaptureEditorStore((s) => s.undo);
  const redo = useCaptureEditorStore((s) => s.redo);

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <nav className="flex w-12 shrink-0 flex-col items-center gap-0.5 self-start rounded-lg border border-border bg-surface-2 py-2">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <RailTooltip key={id} label={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={tool === id}
              onClick={() => (id === 'chip' ? addChip() : setTool(id))}
              className={railButtonClass(tool === id)}
            >
              <Icon size={16} strokeWidth={1.75} />
            </button>
          </RailTooltip>
        ))}

        <div className="my-1.5 h-px w-6 bg-border-dark" />

        <Popover.Root>
          <RailTooltip label="Round corners">
            <Popover.Trigger
              aria-label="Round corners"
              className={railButtonClass(cornerRadius > 0)}
            >
              <Squircle size={16} strokeWidth={1.75} />
            </Popover.Trigger>
          </RailTooltip>
          <Popover.Content side="right" align="start" className="w-64">
            <div className="flex items-center gap-3 px-1 py-0.5">
              <span className="shrink-0 text-xs text-text-dim">Radius</span>
              <input
                type="range"
                aria-label="Corner radius"
                min={0}
                max={MAX_CORNER_RADIUS_UNITS}
                step={1}
                value={Math.round(cornerRadius / unit)}
                onChange={(e) => setCornerRadius(Number(e.target.value) * unit)}
                className="h-1 w-full cursor-pointer accent-(--color-accent)"
              />
              <Input
                type="number"
                size="sm"
                aria-label="Corner radius in pixels"
                min={0}
                max={Math.round(MAX_CORNER_RADIUS_UNITS * unit)}
                value={Math.round(cornerRadius)}
                onChange={(e) => {
                  const px = Number(e.target.value);
                  if (Number.isNaN(px)) return;
                  setCornerRadius(Math.min(Math.max(0, px), MAX_CORNER_RADIUS_UNITS * unit));
                }}
                className="w-16 shrink-0"
              />
              <span className="shrink-0 text-xs text-text-dim">px</span>
            </div>
          </Popover.Content>
        </Popover.Root>

        <div className="my-1.5 h-px w-6 bg-border-dark" />

        <RailTooltip label="Undo">
          <button
            type="button"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
            className={railButtonClass(false)}
          >
            <Undo2 size={16} strokeWidth={1.75} />
          </button>
        </RailTooltip>
        <RailTooltip label="Redo">
          <button
            type="button"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
            className={railButtonClass(false)}
          >
            <Redo2 size={16} strokeWidth={1.75} />
          </button>
        </RailTooltip>
      </nav>
    </Tooltip.Provider>
  );
}
