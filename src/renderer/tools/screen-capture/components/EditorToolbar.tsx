import type { JSX } from 'react';
import {
  Ban,
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
  Undo2,
  Wallpaper
} from 'lucide-react';
import { cn } from 'cnfast';
import { WALLPAPER_PRESETS, cssGradient } from '@shared/wallpaper-presets';
import { Input } from '@renderer/components/ui/Input';
import { Popover } from '@renderer/components/ui/Popover';
import { Select } from '@renderer/components/ui/Select';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import {
  BACKGROUND_SIZE_PRESETS,
  DEFAULT_BACKGROUND,
  FONT_TIERS,
  MAX_CORNER_RADIUS_UNITS,
  useCaptureEditorStore
} from '../store/editor.store';
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

const MAX_BACKGROUND_MARGIN_PCT = 25;
const MAX_FRAME_PX = 8192;

function clampFramePx(px: number): number {
  return Math.min(Math.max(1, Math.round(px)), MAX_FRAME_PX);
}

/** Background popover body: wallpaper swatches, output size, and margin. */
function BackgroundControls(): JSX.Element {
  const background = useCaptureEditorStore((s) => s.background);
  const setBackground = useCaptureEditorStore((s) => s.setBackground);

  const sizePresetId = background
    ? (BACKGROUND_SIZE_PRESETS.find(
        (p) => p.width === background.width && p.height === background.height
      )?.id ?? 'custom')
    : 'custom';

  return (
    <div className="flex flex-col gap-3 px-1 py-0.5">
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          aria-label="No background"
          aria-pressed={background === null}
          title="None"
          onClick={() => setBackground(null)}
          className={cn(
            'flex h-7 cursor-pointer items-center justify-center rounded-md border border-border-dark text-text-dim',
            background === null
              ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface'
              : 'hover:bg-surface-3'
          )}
        >
          <Ban size={14} />
        </button>
        {WALLPAPER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-label={`${preset.label} background`}
            aria-pressed={background?.wallpaper === preset.id}
            title={preset.label}
            onClick={() =>
              setBackground(
                background
                  ? { ...background, wallpaper: preset.id }
                  : { ...DEFAULT_BACKGROUND, wallpaper: preset.id }
              )
            }
            className={cn(
              'h-7 cursor-pointer rounded-md',
              background?.wallpaper === preset.id
                ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface'
                : 'hover:opacity-85'
            )}
            style={{ background: cssGradient(preset) }}
          />
        ))}
      </div>

      {background && (
        <>
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-xs text-text-dim">Size</span>
            <Select.Root
              value={sizePresetId}
              onValueChange={(value) => {
                const preset = BACKGROUND_SIZE_PRESETS.find((p) => p.id === value);
                if (preset)
                  setBackground({ ...background, width: preset.width, height: preset.height });
              }}
            >
              <Select.Trigger size="sm" className="flex-1">
                {/* base-ui's Select.Value renders the raw value ("full-hd"), so render the label ourselves. */}
                <span className="truncate">
                  {BACKGROUND_SIZE_PRESETS.find((p) => p.id === sizePresetId)?.label ?? 'Custom'}
                </span>
              </Select.Trigger>
              <Select.Content side="bottom" align="start">
                {BACKGROUND_SIZE_PRESETS.map((p) => (
                  <Select.Item key={p.id} value={p.id}>
                    {p.label} ({p.width}x{p.height})
                  </Select.Item>
                ))}
                <Select.Item value="custom">Custom size</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-xs text-text-dim">Custom</span>
            <Input
              type="number"
              size="sm"
              aria-label="Background width in pixels"
              min={1}
              max={MAX_FRAME_PX}
              value={background.width}
              onChange={(e) => {
                const px = Number(e.target.value);
                if (Number.isNaN(px)) return;
                setBackground({ ...background, width: clampFramePx(px) });
              }}
              className="min-w-0 flex-1"
            />
            <span className="shrink-0 text-xs text-text-dim">x</span>
            <Input
              type="number"
              size="sm"
              aria-label="Background height in pixels"
              min={1}
              max={MAX_FRAME_PX}
              value={background.height}
              onChange={(e) => {
                const px = Number(e.target.value);
                if (Number.isNaN(px)) return;
                setBackground({ ...background, height: clampFramePx(px) });
              }}
              className="min-w-0 flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-xs text-text-dim">Margin</span>
            <input
              type="range"
              aria-label="Background margin"
              min={0}
              max={MAX_BACKGROUND_MARGIN_PCT}
              step={1}
              value={background.marginPct}
              onChange={(e) => setBackground({ ...background, marginPct: Number(e.target.value) })}
              className="h-1 w-full cursor-pointer accent-(--color-accent)"
            />
            <Input
              type="number"
              size="sm"
              aria-label="Background margin in percent"
              min={0}
              max={MAX_BACKGROUND_MARGIN_PCT}
              value={background.marginPct}
              onChange={(e) => {
                const pct = Number(e.target.value);
                if (Number.isNaN(pct)) return;
                setBackground({
                  ...background,
                  marginPct: Math.min(Math.max(0, Math.round(pct)), MAX_BACKGROUND_MARGIN_PCT)
                });
              }}
              className="w-14 shrink-0"
            />
            <span className="shrink-0 text-xs text-text-dim">%</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Vertical tool rail on the left edge of the editor stage. */
export function EditorToolbar(): JSX.Element {
  const tool = useCaptureEditorStore((s) => s.tool);
  const setTool = useCaptureEditorStore((s) => s.setTool);
  const cornerRadius = useCaptureEditorStore((s) => s.cornerRadius);
  const setCornerRadius = useCaptureEditorStore((s) => s.setCornerRadius);
  const hasBackground = useCaptureEditorStore((s) => s.background !== null);
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

        <Popover.Root>
          <RailTooltip label="Background">
            <Popover.Trigger aria-label="Background" className={railButtonClass(hasBackground)}>
              <Wallpaper size={16} strokeWidth={1.75} />
            </Popover.Trigger>
          </RailTooltip>
          <Popover.Content side="right" align="start" className="w-72">
            <BackgroundControls />
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
