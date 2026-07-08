import type { JSX } from 'react';
import type { ImageAnnotation as ImageAnnotationType } from '@screen-studio/types/project';

// TODO: draggable/resizable image overlay with an asset picker (drag & drop
// or file dialog via a future IPC handler).
export function ImageAnnotation({ annotation }: { annotation: ImageAnnotationType }): JSX.Element {
  return (
    <img
      src={annotation.assetPath}
      alt=""
      className="absolute"
      style={{ left: annotation.position.x, top: annotation.position.y }}
    />
  );
}
