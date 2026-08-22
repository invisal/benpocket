import type { JSX } from 'react';
import { ArrowUpRight, ImagePlus, Type } from 'lucide-react';
import type { Annotation } from '@screen-recorder/types/project';
import { annotationLabel } from '../lib/annotation-label';
import { cn } from '../../../lib/utils';

const KIND_ICON: Record<Annotation['kind'], typeof Type> = {
  text: Type,
  arrow: ArrowUpRight,
  image: ImagePlus
};

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

interface AnnotationListProps {
  /** Must already be sorted by `atMs`. */
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AnnotationList({
  annotations,
  selectedId,
  onSelect
}: AnnotationListProps): JSX.Element {
  if (annotations.length === 0) {
    return <p className="text-sm text-muted-foreground">No annotations yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {annotations.map((annotation) => {
        const Icon = KIND_ICON[annotation.kind];
        return (
          <button
            key={annotation.id}
            onClick={() => onSelect(annotation.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors',
              selectedId === annotation.id
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-line text-muted-foreground hover:border-accent/40'
            )}
          >
            <Icon size={13} className="shrink-0" />
            <span className="flex-1 truncate">{annotationLabel(annotation)}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {formatTime(annotation.atMs)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
