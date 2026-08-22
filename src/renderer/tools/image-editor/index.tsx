import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import cn from 'cnfast';
import { useImageEditor } from './hooks/useImageEditor';
import { PreviewTool } from './components/PreviewTool';
import { GenerativeTool } from './components/GenerativeTool';
import { ResizeTool } from './components/ResizeTool';
import { CropTool } from './components/CropTool';
import { ContextResizeTool } from './components/ContextResizeTool';
import { ContextRemovalTool } from './components/ContextRemovalTool';
import { UpscaleTool } from './components/UpscaleTool';
import { BgRemoveTool } from './components/BgRemoveTool';
import type { ImageToolProps } from './types';

export type { ImageToolProps, ImageToolId, ImageViewInfo } from './types';
export { EDITABLE_MIME_TYPES } from './types';
export { ToolSelectorMenu } from './components/ToolSelectorMenu';

export function ImageTool({
  binary,
  mimeType,
  onChange,
  tool,
  onViewChange,
  className
}: ImageToolProps) {
  const { binary: currentBinary, decode, commit } = useImageEditor(binary, mimeType, onChange);
  // Owned here (not per-tool) so it survives switching between tools -- e.g. Resize and Crop remount
  // their own `ImageCanvas` on every tool switch, but the zoom/pan shouldn't reset along with them.
  // `zoom: null` means "auto-fit" (the default); `ImageCanvas` reports what that resolves to on
  // screen via `effectiveZoom`, since only it knows the fit scale.
  const [zoom, setZoom] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [effectiveZoom, setEffectiveZoom] = useState(1);

  useEffect(() => {
    if (decode.status !== 'ready') {
      onViewChange?.(null);
      return;
    }
    onViewChange?.({
      width: decode.imageData.width,
      height: decode.imageData.height,
      zoom: effectiveZoom
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decode, effectiveZoom]);

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
          'flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground',
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
    onCommit: commit,
    zoom,
    onZoomChange: setZoom,
    onEffectiveZoomChange: setEffectiveZoom,
    pan,
    onPanChange: setPan
  };

  return (
    <div className={cn('relative h-full min-h-0 w-full', className)}>
      {tool === 'preview' && (
        <PreviewTool
          imageData={decode.imageData}
          zoom={zoom}
          onZoomChange={setZoom}
          onEffectiveZoomChange={setEffectiveZoom}
          pan={pan}
          onPanChange={setPan}
        />
      )}
      {tool === 'generative' && <GenerativeTool {...toolProps} />}
      {tool === 'resize' && <ResizeTool {...toolProps} />}
      {tool === 'crop' && <CropTool {...toolProps} />}
      {tool === 'context-resize' && <ContextResizeTool {...toolProps} />}
      {tool === 'context-removal' && <ContextRemovalTool {...toolProps} />}
      {tool === 'upscale' && <UpscaleTool {...toolProps} />}
      {tool === 'bg-remove' && <BgRemoveTool {...toolProps} />}
    </div>
  );
}
