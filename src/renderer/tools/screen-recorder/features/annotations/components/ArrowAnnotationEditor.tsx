import type { JSX } from 'react';
import { Ruler } from 'lucide-react';
import type { ArrowAnnotation } from '@screen-recorder/types/project';
import { MIN_ARROW_THICKNESS, MAX_ARROW_THICKNESS } from '../store/annotations-store';
import { SliderRow } from '../../../components/ui/slider-row';
import { ANNOTATION_COLOR_SWATCHES, ColorSwatchPicker } from './ColorSwatchPicker';
import { cn } from '../../../lib/utils';

const ARROW_STYLES: { id: ArrowAnnotation['style']; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' }
];

interface ArrowAnnotationEditorProps {
  annotation: ArrowAnnotation;
  onUpdate: (patch: Partial<ArrowAnnotation>) => void;
}

export function ArrowAnnotationEditor({
  annotation,
  onUpdate
}: ArrowAnnotationEditorProps): JSX.Element {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Color</span>
        <ColorSwatchPicker
          value={annotation.color}
          onChange={(color) => color && onUpdate({ color })}
          swatches={ANNOTATION_COLOR_SWATCHES}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Line style</span>
        <div className="grid grid-cols-2 gap-1.5">
          {ARROW_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onUpdate({ style: style.id })}
              className={cn(
                'rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                annotation.style === style.id
                  ? 'border-accent text-accent'
                  : 'border-line text-muted-foreground hover:border-accent/40'
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      <SliderRow
        icon={Ruler}
        label="Thickness"
        value={annotation.thickness}
        displayValue={`${annotation.thickness}px`}
        min={MIN_ARROW_THICKNESS}
        max={MAX_ARROW_THICKNESS}
        step={1}
        onChange={(thickness) => onUpdate({ thickness })}
      />
    </>
  );
}
