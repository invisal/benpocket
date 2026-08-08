import type { Annotation } from '@screen-recorder/types/project';

export function annotationLabel(annotation: Annotation): string {
  if (annotation.kind === 'text') return annotation.text || 'Text';
  if (annotation.kind === 'arrow') return 'Arrow';
  return 'Image';
}
