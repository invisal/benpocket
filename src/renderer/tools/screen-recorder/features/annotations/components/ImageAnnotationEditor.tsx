import type { JSX } from 'react';
import type { ImageAnnotation } from '@screen-recorder/types/project';
import { Button } from '@renderer/components/ui/Button';

interface ImageAnnotationEditorProps {
  annotation: ImageAnnotation;
  onReplaceClick: () => void;
  onUpdate: (patch: Partial<ImageAnnotation>) => void;
}

export function ImageAnnotationEditor({
  annotation,
  onReplaceClick,
  onUpdate
}: ImageAnnotationEditorProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video overflow-hidden rounded-lg border border-line bg-surface">
        <img src={annotation.assetPath} alt="" className="h-full w-full object-contain" />
      </div>
      <Button variant="secondary" onClick={onReplaceClick} className="text-sm">
        Replace image…
      </Button>
      {annotation.size && (
        <Button variant="secondary" onClick={() => onUpdate({ size: null })} className="text-sm">
          Reset size
        </Button>
      )}
    </div>
  );
}
