import type { JSX } from 'react';
import { useRef } from 'react';
import { ArrowUpRight, ImagePlus, Trash2, Type } from 'lucide-react';
import type { Annotation } from '@screen-recorder/types/project';
import {
  useAnnotationsStore,
  MIN_ARROW_THICKNESS,
  MAX_ARROW_THICKNESS
} from '../store/annotations-store';
import { TEXT_ANIMATION_PRESETS } from '../presets/text-animation-presets';
import { Slider } from '../../../components/ui/slider';
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

const ARROW_COLOR_SWATCHES = [
  '#ffffff',
  '#ef4444',
  '#f59e0b',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899'
];
const ARROW_STYLES: { id: 'solid' | 'dashed'; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' }
];

const KIND_ICON: Record<Annotation['kind'], typeof Type> = {
  text: Type,
  arrow: ArrowUpRight,
  image: ImagePlus
};

function annotationLabel(annotation: Annotation): string {
  if (annotation.kind === 'text') return annotation.text || 'Text';
  if (annotation.kind === 'arrow') return 'Arrow';
  return 'Image';
}

interface AnnotationsPanelProps {
  /** Current preview position (ms, source-relative) -- "Add" targets this. */
  currentTimeMs: number;
}

export function AnnotationsPanel({ currentTimeMs }: AnnotationsPanelProps): JSX.Element {
  const annotations = useAnnotationsStore((s) => s.annotations);
  const selectedAnnotationId = useAnnotationsStore((s) => s.selectedAnnotationId);
  const setSelectedAnnotationId = useAnnotationsStore((s) => s.setSelectedAnnotationId);
  const addTextAnnotation = useAnnotationsStore((s) => s.addTextAnnotation);
  const addArrowAnnotation = useAnnotationsStore((s) => s.addArrowAnnotation);
  const addImageAnnotation = useAnnotationsStore((s) => s.addImageAnnotation);
  const removeAnnotation = useAnnotationsStore((s) => s.removeAnnotation);
  const updateAnnotation = useAnnotationsStore((s) => s.updateAnnotation);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sorted = [...annotations].sort((a, b) => a.atMs - b.atMs);
  const selected = sorted.find((a) => a.id === selectedAnnotationId) ?? null;

  function handleImageFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      if (selected?.kind === 'image') {
        updateAnnotation(selected.id, { assetPath: reader.result });
      } else {
        addImageAnnotation(currentTimeMs, reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          onClick={() => addTextAnnotation(currentTimeMs)}
          className="flex flex-col items-center gap-1 py-2 text-xs"
        >
          <Type size={14} /> Text
        </Button>
        <Button
          variant="secondary"
          onClick={() => addArrowAnnotation(currentTimeMs)}
          className="flex flex-col items-center gap-1 py-2 text-xs"
        >
          <ArrowUpRight size={14} /> Arrow
        </Button>
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 py-2 text-xs"
        >
          <ImagePlus size={14} /> Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFile}
        />
      </div>
      <p className="text-[11px] leading-snug text-white/30">
        Adds at {formatTime(currentTimeMs)} -- drag directly on the preview to reposition.
      </p>

      {sorted.length === 0 && <p className="text-xs text-white/40">No annotations yet.</p>}

      {sorted.length > 0 && (
        <div className="flex flex-col gap-1">
          {sorted.map((annotation) => {
            const Icon = KIND_ICON[annotation.kind];
            return (
              <button
                key={annotation.id}
                onClick={() => setSelectedAnnotationId(annotation.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                  selectedAnnotationId === annotation.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line text-white/60 hover:border-white/20'
                )}
              >
                <Icon size={13} className="shrink-0" />
                <span className="flex-1 truncate">{annotationLabel(annotation)}</span>
                <span className="shrink-0 font-mono text-[10px] text-white/40">
                  {formatTime(annotation.atMs)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">
              {annotationLabel(selected)}
            </span>
            <button
              onClick={() => removeAnnotation(selected.id)}
              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {selected.kind === 'text' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                  Text
                </span>
                <textarea
                  value={selected.text}
                  onChange={(e) => updateAnnotation(selected.id, { text: e.target.value })}
                  rows={2}
                  className="resize-none rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                  Entrance animation
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEXT_ANIMATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => updateAnnotation(selected.id, { animationPreset: preset.id })}
                      className={cn(
                        'rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                        selected.animationPreset === preset.id
                          ? 'border-accent text-accent'
                          : 'border-line text-white/50 hover:border-white/20'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {selected.kind === 'arrow' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                  Color
                </span>
                <div className="grid grid-cols-8 gap-1.5">
                  {ARROW_COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateAnnotation(selected.id, { color })}
                      title={color}
                      aria-label={color}
                      className={cn(
                        'aspect-square rounded-md ring-2 ring-offset-2 ring-offset-surface-sunken transition-all',
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
                  onChange={(e) => updateAnnotation(selected.id, { color: e.target.value })}
                  className="h-7 w-full cursor-pointer rounded-lg border border-line bg-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                  Line style
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ARROW_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => updateAnnotation(selected.id, { style: style.id })}
                      className={cn(
                        'rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                        selected.style === style.id
                          ? 'border-accent text-accent'
                          : 'border-line text-white/50 hover:border-white/20'
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                    Thickness
                  </span>
                  <span className="text-[11px] text-white/50">{selected.thickness}px</span>
                </div>
                <Slider
                  value={selected.thickness}
                  min={MIN_ARROW_THICKNESS}
                  max={MAX_ARROW_THICKNESS}
                  step={1}
                  onChange={(thickness) => updateAnnotation(selected.id, { thickness })}
                />
              </div>
            </>
          )}

          {selected.kind === 'image' && (
            <div className="flex flex-col gap-2">
              <div className="aspect-video overflow-hidden rounded-lg border border-line bg-black/30">
                <img src={selected.assetPath} alt="" className="h-full w-full object-contain" />
              </div>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                Replace image…
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                Starts at
              </span>
              <span className="text-[11px] text-white/50">{formatTime(selected.atMs)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
                Duration
              </span>
              <span className="text-[11px] text-white/50">
                {(selected.durationMs / 1000).toFixed(1)}s
              </span>
            </div>
            <Slider
              value={selected.durationMs}
              min={MIN_DURATION_MS}
              max={MAX_DURATION_MS}
              step={100}
              onChange={(durationMs) => updateAnnotation(selected.id, { durationMs })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
