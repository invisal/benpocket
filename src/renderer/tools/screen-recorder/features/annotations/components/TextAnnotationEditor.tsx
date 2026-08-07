import type { JSX } from 'react';
import { Gauge } from 'lucide-react';
import type { TextAnnotation } from '@screen-recorder/types/project';
import { MIN_TEXT_ANIMATION_SPEED, MAX_TEXT_ANIMATION_SPEED } from '../store/annotations-store';
import { SliderRow } from '../../../components/ui/slider-row';
import { ANNOTATION_COLOR_SWATCHES, ColorSwatchPicker } from './ColorSwatchPicker';
import { FontSizeSelect } from './FontSizeSelect';
import { AnimationPresetSelect } from './AnimationPresetSelect';

interface TextAnnotationEditorProps {
  annotation: TextAnnotation;
  onUpdate: (patch: Partial<TextAnnotation>) => void;
}

export function TextAnnotationEditor({
  annotation,
  onUpdate
}: TextAnnotationEditorProps): JSX.Element {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">Text</span>
        <textarea
          value={annotation.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          className="resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Text color</span>
        <ColorSwatchPicker
          value={annotation.color}
          onChange={(color) => color && onUpdate({ color })}
          swatches={ANNOTATION_COLOR_SWATCHES}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Background</span>
        <ColorSwatchPicker
          value={annotation.backgroundColor}
          onChange={(backgroundColor) => onUpdate({ backgroundColor })}
          swatches={ANNOTATION_COLOR_SWATCHES}
          allowNone
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Font size</span>
        <FontSizeSelect
          value={annotation.fontSize}
          onChange={(fontSize) => onUpdate({ fontSize })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Entrance animation</span>
        <AnimationPresetSelect
          value={annotation.animationPreset}
          onChange={(animationPreset) => onUpdate({ animationPreset })}
        />
      </div>

      {annotation.animationPreset !== 'none' && (
        <SliderRow
          icon={Gauge}
          label="Speed"
          value={annotation.animationSpeed}
          displayValue={`${annotation.animationSpeed.toFixed(2)}x`}
          min={MIN_TEXT_ANIMATION_SPEED}
          max={MAX_TEXT_ANIMATION_SPEED}
          step={0.25}
          onChange={(animationSpeed) => onUpdate({ animationSpeed })}
        />
      )}
    </>
  );
}
