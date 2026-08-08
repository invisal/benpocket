import { AlertCircle, Loader2 } from 'lucide-react';
import cn from 'cnfast';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import { useImageEditor } from './hooks/useImageEditor';
import { ToolSelectorMenu } from './components/ToolSelectorMenu';
import { ResizeTool } from './components/ResizeTool';
import { CropTool } from './components/CropTool';
import { ContextResizeTool } from './components/ContextResizeTool';
import { ContextRemovalTool } from './components/ContextRemovalTool';
import type { ImageToolProps } from './types';

export type { ImageToolProps, ImageToolId } from './types';
export { EDITABLE_MIME_TYPES } from './types';

export function ImageTool({ binary, mimeType, onChange, className }: ImageToolProps) {
  const {
    binary: currentBinary,
    decode,
    activeTool,
    setActiveTool,
    commit
  } = useImageEditor(binary, mimeType, onChange);

  if (decode.status === 'loading') {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center text-muted-foreground', className)}
      >
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (decode.status === 'error') {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground',
          className
        )}
      >
        <AlertCircle size={20} className="text-red-500" />
        <span>{decode.message}</span>
      </div>
    );
  }

  const toolProps = {
    imageData: decode.imageData,
    binary: currentBinary,
    mimeType,
    onCommit: commit
  };

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      <Toolbar.Root>
        <ToolSelectorMenu active={activeTool} onSelect={setActiveTool} />
      </Toolbar.Root>
      <div className="relative min-h-0 flex-1">
        {activeTool === 'resize' && <ResizeTool {...toolProps} />}
        {activeTool === 'crop' && <CropTool {...toolProps} />}
        {activeTool === 'context-resize' && <ContextResizeTool {...toolProps} />}
        {activeTool === 'context-removal' && <ContextRemovalTool {...toolProps} />}
      </div>
    </div>
  );
}
