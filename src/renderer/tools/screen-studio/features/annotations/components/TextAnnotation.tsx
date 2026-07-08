import type { JSX } from 'react';
import type { TextAnnotation as TextAnnotationType } from '@screen-studio/types/project';

// TODO: draggable, resizable text box; apply the selected animation preset
// (see ../presets/text-animation-presets.ts) on enter/exit during playback.
export function TextAnnotation({ annotation }: { annotation: TextAnnotationType }): JSX.Element {
  return (
    <div
      className="absolute text-sm font-medium"
      style={{ left: annotation.position.x, top: annotation.position.y }}
    >
      {annotation.text}
    </div>
  );
}
