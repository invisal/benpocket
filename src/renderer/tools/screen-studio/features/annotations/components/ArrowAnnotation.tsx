import type { JSX } from 'react';
import type { ArrowAnnotation as ArrowAnnotationType } from '@screen-studio/types/project';

// TODO: render an SVG arrow (with arrowhead marker) from position -> to,
// with draggable endpoints and a color/thickness picker.
export function ArrowAnnotation({ annotation }: { annotation: ArrowAnnotationType }): JSX.Element {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      <line
        x1={annotation.position.x}
        y1={annotation.position.y}
        x2={annotation.to.x}
        y2={annotation.to.y}
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  );
}
