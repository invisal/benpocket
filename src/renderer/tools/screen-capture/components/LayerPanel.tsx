import type { JSX } from 'react';
import { useRef, useState } from 'react';
import {
  Captions,
  ChevronDown,
  Circle,
  Droplets,
  Eye,
  EyeOff,
  MoveUpRight,
  Square,
  Tag,
  Trash2,
  Type
} from 'lucide-react';
import { cn } from 'cnfast';
import { Input } from '@renderer/components/ui/Input';
import {
  BLUR_TIERS,
  EDITOR_COLORS,
  FONT_TIERS,
  STROKE_TIERS,
  useCaptureEditorStore
} from '../store/editor.store';
import type { CaptureAnnotation } from '../types/editor';

const KIND_ICONS = {
  text: Type,
  chip: Captions,
  label: Tag,
  rect: Square,
  circle: Circle,
  arrow: MoveUpRight,
  blur: Droplets
} as const;

/** Quick word presets for a chip; anything else counts as custom text. */
const CHIP_PRESETS = ['Before', 'After'];

function layerLabel(annotation: CaptureAnnotation): string {
  if (annotation.name) return annotation.name;
  switch (annotation.kind) {
    case 'text':
      return 'Text';
    case 'chip':
      return 'Text label';
    case 'label':
      return `Label ${annotation.value}`;
    case 'rect':
      return 'Rectangle';
    case 'circle':
      return 'Circle';
    case 'arrow':
      return 'Arrow';
    case 'blur':
      return 'Blur';
  }
}

function tierButtonClass(active: boolean): string {
  return cn(
    'flex h-7 w-8 cursor-pointer items-center justify-center rounded-md transition-colors',
    active ? 'bg-surface-4 text-accent' : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
  );
}

/**
 * Per-kind properties for a layer, shown in the row's dropdown: color for
 * everything visible, stroke width for rect/arrow, size and content for text,
 * intensity for blur. The setters double as the defaults for the next
 * annotation (setColor/setStrokeTier/setFontTier/setBlurTier update both), so
 * editing a layer also carries the style forward.
 */
function LayerProperties({ annotation }: { annotation: CaptureAnnotation }): JSX.Element {
  const setColor = useCaptureEditorStore((s) => s.setColor);
  const setStrokeTier = useCaptureEditorStore((s) => s.setStrokeTier);
  const setFontTier = useCaptureEditorStore((s) => s.setFontTier);
  const setBlurTier = useCaptureEditorStore((s) => s.setBlurTier);
  const patchAnnotation = useCaptureEditorStore((s) => s.patchAnnotation);
  const unit = useCaptureEditorStore((s) => s.unit);
  // Pre-edit text stashed on focus so an emptied field can revert on blur.
  const textBeforeEdit = useRef('');

  const isCustomChip = annotation.kind === 'chip' && !CHIP_PRESETS.includes(annotation.text);

  return (
    <div className="flex flex-col gap-2 px-2 pt-1 pb-2" onClick={(e) => e.stopPropagation()}>
      {annotation.kind === 'chip' && (
        <div className="flex items-center gap-1">
          {CHIP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={annotation.text === preset}
              onClick={() => patchAnnotation(annotation.id, { text: preset })}
              className={cn(tierButtonClass(annotation.text === preset), 'w-auto px-2 text-xs')}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={isCustomChip}
            onClick={() => patchAnnotation(annotation.id, { text: 'Custom' })}
            className={cn(tierButtonClass(isCustomChip), 'w-auto px-2 text-xs')}
          >
            Custom
          </button>
        </div>
      )}

      {(annotation.kind === 'text' || isCustomChip) && (
        <Input
          size="sm"
          aria-label="Text content"
          value={annotation.text}
          onFocus={() => {
            textBeforeEdit.current = annotation.text;
            useCaptureEditorStore.getState().beginGesture();
          }}
          onChange={(e) =>
            useCaptureEditorStore.getState().moveAnnotation(annotation.id, {
              text: e.target.value
            })
          }
          onBlur={(e) => {
            const s = useCaptureEditorStore.getState();
            if (!e.target.value.trim()) {
              s.moveAnnotation(annotation.id, { text: textBeforeEdit.current });
            }
            s.endGesture();
          }}
        />
      )}

      {annotation.kind !== 'blur' && (
        <div className="flex items-center gap-1.5">
          {EDITOR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={annotation.color === c}
              onClick={() => setColor(c, annotation.id)}
              className={cn(
                'h-3.5 w-3.5 cursor-pointer rounded-full border border-border-dark transition-transform',
                annotation.color === c && 'scale-110 ring-2 ring-accent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {(annotation.kind === 'rect' ||
        annotation.kind === 'circle' ||
        annotation.kind === 'arrow') && (
        <div className="flex items-center gap-1">
          {STROKE_TIERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              aria-label={`${label} stroke`}
              aria-pressed={Math.round(annotation.strokeWidth / unit) === value}
              onClick={() => setStrokeTier(value, annotation.id)}
              className={tierButtonClass(Math.round(annotation.strokeWidth / unit) === value)}
            >
              <span
                className="w-3.5 rounded-full bg-current"
                style={{ height: Math.max(1.5, value) }}
              />
            </button>
          ))}
        </div>
      )}

      {(annotation.kind === 'text' || annotation.kind === 'chip') && (
        <div className="flex items-end gap-1">
          {FONT_TIERS.map(({ label, value }, index) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={Math.round(annotation.fontSize / unit) === value}
              onClick={() => setFontTier(value, annotation.id)}
              className={cn(
                tierButtonClass(Math.round(annotation.fontSize / unit) === value),
                'items-end pb-0.5 font-medium'
              )}
              style={{ fontSize: 10 + index * 3 }}
            >
              A
            </button>
          ))}
        </div>
      )}

      {annotation.kind === 'blur' && (
        <div className="flex items-center gap-1">
          {BLUR_TIERS.map(({ label, value }, index) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={Math.round(annotation.blurRadius / unit) === value}
              onClick={() => setBlurTier(value, annotation.id)}
              className={tierButtonClass(Math.round(annotation.blurRadius / unit) === value)}
            >
              <Droplets size={10 + index * 3} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Photoshop-style layer list: topmost layer first. Rows are draggable —
 * dropping one onto another moves it to that stacking position (annotations
 * render and export in array order, last = topmost). Double-click renames a
 * layer; the trash button
 * deletes it. The selected layer's properties are edited at the bottom.
 */
export function LayerPanel(): JSX.Element {
  const annotations = useCaptureEditorStore((s) => s.annotations);
  const selectedId = useCaptureEditorStore((s) => s.selectedId);
  const setSelectedId = useCaptureEditorStore((s) => s.setSelectedId);
  const moveLayer = useCaptureEditorStore((s) => s.moveLayer);
  const removeAnnotation = useCaptureEditorStore((s) => s.removeAnnotation);
  const patchAnnotation = useCaptureEditorStore((s) => s.patchAnnotation);
  const [dragId, setDragId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const topFirst = [...annotations].reverse();

  function commitRename(id: string, value: string): void {
    const trimmed = value.trim();
    // Empty name reverts to the kind-based default.
    patchAnnotation(id, { name: trimmed || undefined });
    setRenamingId(null);
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-2">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-medium text-text-dim">
        Layers
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
        {topFirst.length === 0 && <p className="px-2 py-3 text-xs text-text-dim">No edits yet.</p>}
        {topFirst.map((annotation) => {
          const Icon = KIND_ICONS[annotation.kind];
          const isRenaming = renamingId === annotation.id;
          const isExpanded = expandedId === annotation.id;
          return (
            <div
              key={annotation.id}
              className={cn(
                'overflow-hidden rounded-md border',
                selectedId === annotation.id ? 'border-accent' : 'border-border'
              )}
            >
              <div
                draggable={!isRenaming}
                onDragStart={() => setDragId(annotation.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== annotation.id) {
                    moveLayer(
                      dragId,
                      annotations.findIndex((a) => a.id === annotation.id)
                    );
                  }
                  setDragId(null);
                }}
                onClick={() => setSelectedId(annotation.id)}
                onDoubleClick={() => setRenamingId(annotation.id)}
                className={cn(
                  'group flex cursor-grab items-center gap-2 px-2 py-1.5 text-xs select-none',
                  selectedId === annotation.id
                    ? 'bg-surface-4 text-text-base'
                    : 'text-text-dim hover:bg-surface-3 hover:text-text-base',
                  dragId === annotation.id && 'opacity-50'
                )}
              >
                <button
                  type="button"
                  aria-label={annotation.hidden ? 'Show layer' : 'Hide layer'}
                  aria-pressed={annotation.hidden ?? false}
                  onClick={(e) => {
                    e.stopPropagation();
                    patchAnnotation(annotation.id, { hidden: !annotation.hidden });
                  }}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-text-dim transition-colors hover:text-text-base"
                >
                  {annotation.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <Icon size={13} className={cn('shrink-0', annotation.hidden && 'opacity-40')} />
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={annotation.name ?? ''}
                    placeholder={layerLabel(annotation)}
                    onBlur={(e) => commitRename(annotation.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(annotation.id, e.currentTarget.value);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full min-w-0 rounded-sm border border-border bg-surface px-1 py-0.5 text-xs text-text-base outline-none focus-visible:border-accent"
                  />
                ) : (
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      annotation.hidden && 'opacity-40 line-through'
                    )}
                  >
                    {layerLabel(annotation)}
                  </span>
                )}
                {!isRenaming && (
                  <span className="ml-auto flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label="Layer properties"
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(annotation.id);
                        setExpandedId(isExpanded ? null : annotation.id);
                      }}
                      className={cn(
                        'cursor-pointer rounded p-0.5 text-text-dim transition-all hover:text-text-base',
                        isExpanded && 'rotate-180'
                      )}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete layer"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAnnotation(annotation.id);
                      }}
                      className="cursor-pointer rounded p-0.5 text-text-dim transition-colors hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                )}
              </div>
              {isExpanded && <LayerProperties annotation={annotation} />}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
