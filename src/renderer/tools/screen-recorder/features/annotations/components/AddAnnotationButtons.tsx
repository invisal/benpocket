import type { JSX } from 'react';
import { ArrowUpRight, ImagePlus, Type } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';

interface AddAnnotationButtonsProps {
  onAddText: () => void;
  onAddArrow: () => void;
  onAddImage: () => void;
}

export function AddAnnotationButtons({
  onAddText,
  onAddArrow,
  onAddImage
}: AddAnnotationButtonsProps): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        variant="secondary"
        onClick={onAddText}
        className="flex flex-col items-center gap-1 py-2 text-xs"
      >
        <Type size={14} /> Text
      </Button>
      <Button
        variant="secondary"
        onClick={onAddArrow}
        className="flex flex-col items-center gap-1 py-2 text-xs"
      >
        <ArrowUpRight size={14} /> Arrow
      </Button>
      <Button
        variant="secondary"
        onClick={onAddImage}
        className="flex flex-col items-center gap-1 py-2 text-xs"
      >
        <ImagePlus size={14} /> Image
      </Button>
    </div>
  );
}
