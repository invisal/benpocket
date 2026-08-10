import { ImageCanvas } from './ImageCanvas';
import type { ToolPanelProps } from '../types';

/** View-only mode: just the decoded image, no editing controls. Default tool so opening an image
 * doesn't drop the user straight into an editing surface. */
export function PreviewTool({ imageData }: Pick<ToolPanelProps, 'imageData'>) {
  return (
    <div className="relative flex h-full min-h-0 w-full">
      <ImageCanvas imageData={imageData} />
    </div>
  );
}
