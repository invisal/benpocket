import type { JSX } from 'react';
import { useState } from 'react';
import { Droplets, MoveUpRight, Square, Tag, Type } from 'lucide-react';
import { cn } from 'cnfast';
import { useCaptureEditorStore } from '../store/editor.store';
import type { CaptureAnnotation } from '../types/editor';

const KIND_ICONS = {
  text: Type,
  label: Tag,
  rect: Square,
  arrow: MoveUpRight,
  blur: Droplets
} as const;

function layerLabel(annotation: CaptureAnnotation): string {
  switch (annotation.kind) {
    case 'text':
      return annotation.text || 'Text';
    case 'label':
      return `Label ${annotation.value}`;
    case 'rect':
      return 'Rectangle';
    case 'arrow':
      return 'Arrow';
    case 'blur':
      return 'Blur';
  }
}

/**
 * Photoshop-style layer list: topmost layer first. Rows are draggable —
 * dropping one onto another moves it to that stacking position (annotations
 * render and export in array order, last = topmost).
 */
export function LayerPanel(): JSX.Element {
  const annotations = useCaptureEditorStore((s) => s.annotations);
  const selectedId = useCaptureEditorStore((s) => s.selectedId);
  const setSelectedId = useCaptureEditorStore((s) => s.setSelectedId);
  const moveLayer = useCaptureEditorStore((s) => s.moveLayer);
  const [dragId, setDragId] = useState<string | null>(null);

  const topFirst = [...annotations].reverse();

  return (
    <aside className="flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-2">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-medium text-text-dim">
        Layers
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {topFirst.length === 0 && <p className="px-2 py-3 text-xs text-text-dim">No edits yet.</p>}
        {topFirst.map((annotation) => {
          const Icon = KIND_ICONS[annotation.kind];
          return (
            <div
              key={annotation.id}
              draggable
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
              className={cn(
                'flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-xs select-none',
                selectedId === annotation.id
                  ? 'bg-surface-4 text-text-base'
                  : 'text-text-dim hover:bg-surface-3 hover:text-text-base',
                dragId === annotation.id && 'opacity-50'
              )}
            >
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{layerLabel(annotation)}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
