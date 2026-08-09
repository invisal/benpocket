import { useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import cn from 'cnfast';
import { useImageEditor } from './hooks/useImageEditor';
import { PreviewTool } from './components/PreviewTool';
import { ResizeTool } from './components/ResizeTool';
import { CropTool } from './components/CropTool';
import { ContextResizeTool } from './components/ContextResizeTool';
import { ContextRemovalTool } from './components/ContextRemovalTool';
import type { ImageToolProps } from './types';

export type { ImageToolProps, ImageToolId } from './types';
export { EDITABLE_MIME_TYPES } from './types';
export { ToolSelectorMenu } from './components/ToolSelectorMenu';

export function ImageTool({ binary, mimeType, onChange, tool, className }: ImageToolProps) {
  const { binary: currentBinary, decode, commit } = useImageEditor(binary, mimeType, onChange);

  // Mounted inline in File Explorer's preview panel, not as a tab of its own, so it
  // can't rely on createTabProvider's activeTabId subscriber to report `tool_opened`
  // -- report directly on mount instead. telemetryStore.enqueue dedupes repeats within
  // a session, so this can fire every time a file preview mounts one without care.
  useEffect(() => {
    window.telemetry.send({ event: 'tool_opened', tool: 'image-editor' });
  }, []);

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
    <div className={cn('relative h-full min-h-0 w-full', className)}>
      {tool === 'preview' && <PreviewTool imageData={decode.imageData} />}
      {tool === 'resize' && <ResizeTool {...toolProps} />}
      {tool === 'crop' && <CropTool {...toolProps} />}
      {tool === 'context-resize' && <ContextResizeTool {...toolProps} />}
      {tool === 'context-removal' && <ContextRemovalTool {...toolProps} />}
    </div>
  );
}
