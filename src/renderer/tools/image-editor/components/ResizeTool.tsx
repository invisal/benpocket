import { useState } from 'react';
import cn from 'cnfast';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { NumberField } from './NumberField';
import type { ToolPanelProps } from '../types';

/**
 * Self-contained Resize tool: its own canvas, plus a floating control bar docked to the bottom of
 * the previewer. Only one tool is ever mounted at a time (see index.tsx), so the W/H draft fields
 * can be plain local state -- this component is only ever alive while Resize is the active tool,
 * and after its own Apply the working image's dimensions already equal the draft's, so there's
 * nothing to resync. Apply just hands the sharp result to `onCommit`; `ImageTool` decodes it for
 * display, so there's nothing to decode here.
 */
export function ResizeTool({
  imageData,
  onCommit,
  binary,
  mimeType,
  zoom,
  onZoomChange,
  onEffectiveZoomChange,
  pan,
  onPanChange
}: ToolPanelProps) {
  const [width, setWidth] = useState(imageData.width);
  const [height, setHeight] = useState(imageData.height);
  const [lockAspect, setLockAspect] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspect = imageData.width / imageData.height;

  function commitWidth(next: number): void {
    const clamped = Math.max(1, Math.round(next));
    setWidth(clamped);
    if (lockAspect) setHeight(Math.max(1, Math.round(clamped / aspect)));
  }

  function commitHeight(next: number): void {
    const clamped = Math.max(1, Math.round(next));
    setHeight(clamped);
    if (lockAspect) setWidth(Math.max(1, Math.round(clamped * aspect)));
  }

  async function handleApply(): Promise<void> {
    if (width === imageData.width && height === imageData.height) return;
    setIsResizing(true);
    setError(null);
    try {
      const result = await window.imageEditor.resize(binary, width, height, mimeType);
      if ('error' in result) throw new Error(result.error);
      onCommit(new Uint8Array(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResizing(false);
    }
  }

  const hasChange = width !== imageData.width || height !== imageData.height;

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <ImageCanvas
        imageData={imageData}
        zoom={zoom}
        onZoomChange={onZoomChange}
        onEffectiveZoomChange={onEffectiveZoomChange}
        pan={pan}
        onPanChange={onPanChange}
      />
      <FloatingToolbar>
        <NumberField label="W" value={width} onCommit={commitWidth} />
        <NumberField label="H" value={height} onCommit={commitHeight} />
        <button
          onClick={() => setLockAspect((v) => !v)}
          aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded',
            lockAspect ? 'text-accent' : 'text-muted-foreground hover:bg-surface-3'
          )}
        >
          {lockAspect ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void handleApply()}
          disabled={!hasChange || isResizing}
        >
          {isResizing ? 'Resizing…' : 'Apply'}
        </Button>
        {error && <p className="px-1 text-[11px] text-red-500">{error}</p>}
      </FloatingToolbar>
    </div>
  );
}
