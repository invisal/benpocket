import type { JSX } from 'react';
import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useAnnotationsStore } from '../store/annotations-store';
import { annotationLabel } from '../lib/annotation-label';
import { AddAnnotationButtons } from './AddAnnotationButtons';
import { AnnotationList } from './AnnotationList';
import { TextAnnotationEditor } from './TextAnnotationEditor';
import { ArrowAnnotationEditor } from './ArrowAnnotationEditor';
import { ImageAnnotationEditor } from './ImageAnnotationEditor';

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
    <div className="flex flex-col gap-3">
      <AddAnnotationButtons
        onAddText={() => addTextAnnotation(currentTimeMs)}
        onAddArrow={() => addArrowAnnotation(currentTimeMs)}
        onAddImage={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      <AnnotationList
        annotations={sorted}
        selectedId={selectedAnnotationId}
        onSelect={setSelectedAnnotationId}
      />

      {selected && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {annotationLabel(selected)}
            </span>
            <button
              onClick={() => removeAnnotation(selected.id)}
              className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {selected.kind === 'text' && (
            <TextAnnotationEditor
              annotation={selected}
              onUpdate={(patch) => updateAnnotation(selected.id, patch)}
            />
          )}
          {selected.kind === 'arrow' && (
            <ArrowAnnotationEditor
              annotation={selected}
              onUpdate={(patch) => updateAnnotation(selected.id, patch)}
            />
          )}
          {selected.kind === 'image' && (
            <ImageAnnotationEditor
              annotation={selected}
              onReplaceClick={() => fileInputRef.current?.click()}
              onUpdate={(patch) => updateAnnotation(selected.id, patch)}
            />
          )}
        </div>
      )}
    </div>
  );
}
