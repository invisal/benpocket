import { useEffect, useRef, useState } from 'react';
import { Button } from '@renderer/components/ui/Button';
import { runInpaint, INPAINT_CANCELLED_MESSAGE } from '../lib/inpaint/client';
import { encodeImageData } from '../lib/codec';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { MaskOverlay } from './MaskOverlay';
import type { ToolPanelProps } from '../types';

/**
 * Content-aware object removal: paint over something to delete (a person, a sign, a stray object)
 * and PatchMatch inpainting (see `lib/inpaint/`) fills the marked region with texture synthesized
 * from the rest of the photo. The image comes out the same size it went in -- nothing outside the
 * painted region changes at all. Only one tool is mounted at a time (see index.tsx), so mask state
 * is plain local state, reset directly after a successful Apply.
 */
export function ContextRemovalTool({
  imageData,
  onCommit,
  mimeType,
  zoom,
  onZoomChange,
  onEffectiveZoomChange,
  pan,
  onPanChange
}: ToolPanelProps) {
  const maskRef = useRef<Uint8Array<ArrayBuffer>>(
    new Uint8Array(imageData.width * imageData.height)
  );
  const abortRef = useRef<AbortController | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const [brushSize, setBrushSize] = useState(24);
  const [hasMask, setHasMask] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function clearMask(): void {
    maskRef.current.fill(0);
    setMaskVersion((v) => v + 1);
    setHasMask(false);
  }

  async function handleApply(): Promise<void> {
    setError(null);
    setIsRunning(true);
    setProgress({ done: 0, total: 1 });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runInpaint(
        imageData.data,
        imageData.width,
        imageData.height,
        maskRef.current,
        (done, total) => setProgress({ done, total }),
        controller.signal
      );
      const next = new ImageData(result.rgba, result.width, result.height);
      const encoded = await encodeImageData(next, mimeType);
      setProgress(null);
      setIsRunning(false);
      onCommit(encoded);
      clearMask();
    } catch (err) {
      setIsRunning(false);
      setProgress(null);
      const message = err instanceof Error ? err.message : String(err);
      if (message !== INPAINT_CANCELLED_MESSAGE) setError(message);
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <ImageCanvas
        imageData={imageData}
        zoom={zoom}
        onZoomChange={onZoomChange}
        onEffectiveZoomChange={onEffectiveZoomChange}
        pan={pan}
        onPanChange={onPanChange}
      >
        <MaskOverlay
          width={imageData.width}
          height={imageData.height}
          maskRef={maskRef}
          maskVersion={maskVersion}
          brushSize={brushSize}
          onPaint={() => setHasMask(true)}
        />
      </ImageCanvas>

      <FloatingToolbar>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Paint over what to remove</span>
          <input
            type="range"
            min={4}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 accent-accent"
          />
          <button
            onClick={clearMask}
            className="px-2 text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            Clear
          </button>
        </div>

        {isRunning && progress && (
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-accent transition-[width]"
              style={{
                width: `${progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0}%`
              }}
            />
          </div>
        )}
        {error && <p className="px-1 text-[11px] text-red-500">{error}</p>}

        {isRunning ? (
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleApply()}
            disabled={!hasMask}
          >
            Remove
          </Button>
        )}
      </FloatingToolbar>
    </div>
  );
}
