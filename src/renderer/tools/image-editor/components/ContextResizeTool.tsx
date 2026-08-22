import { useEffect, useRef, useState } from 'react';
import { Button } from '@renderer/components/ui/Button';
import { runInpaint, INPAINT_CANCELLED_MESSAGE } from '../lib/inpaint/client';
import { encodeImageData } from '../lib/codec';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { NumberField } from './NumberField';
import type { ToolPanelProps } from '../types';

/**
 * Content-aware expand: grow the canvas, and the new border is synthesized by PatchMatch inpainting
 * (see `lib/inpaint/`) -- the original photo is centered and left completely untouched; only the
 * new surrounding area is filled, using texture copied from elsewhere in the photo rather than
 * uniformly stretching or mirroring it. Expand-only: PatchMatch has no notion of "shrinking" (it
 * only ever fills pixels in), so there's no content-aware shrink direction here -- use the plain
 * Resize tool for that. Only one tool is mounted at a time (see index.tsx), so target-size state is
 * plain local state.
 */
export function ContextResizeTool({
  imageData,
  onCommit,
  mimeType,
  zoom,
  onZoomChange,
  onEffectiveZoomChange,
  pan,
  onPanChange
}: ToolPanelProps) {
  const abortRef = useRef<AbortController | null>(null);
  const [targetWidth, setTargetWidth] = useState(imageData.width);
  const [targetHeight, setTargetHeight] = useState(imageData.height);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const hasChange = targetWidth > imageData.width || targetHeight > imageData.height;

  async function handleApply(): Promise<void> {
    const tw = Math.max(imageData.width, Math.round(targetWidth));
    const th = Math.max(imageData.height, Math.round(targetHeight));
    if (tw === imageData.width && th === imageData.height) return;

    setError(null);
    setIsRunning(true);
    setProgress({ done: 0, total: 1 });
    const controller = new AbortController();
    abortRef.current = controller;

    // Place the original image centered on the larger canvas; everything else is the "hole" for
    // inpainting to fill.
    const left = Math.floor((tw - imageData.width) / 2);
    const top = Math.floor((th - imageData.height) / 2);
    const rgba = new Uint8ClampedArray(tw * th * 4);
    const mask = new Uint8Array(tw * th).fill(1);
    for (let y = 0; y < imageData.height; y++) {
      const srcOffset = y * imageData.width * 4;
      const dstOffset = ((y + top) * tw + left) * 4;
      rgba.set(imageData.data.subarray(srcOffset, srcOffset + imageData.width * 4), dstOffset);
      mask.fill(0, (y + top) * tw + left, (y + top) * tw + left + imageData.width);
    }

    try {
      const result = await runInpaint(
        rgba,
        tw,
        th,
        mask,
        (done, total) => setProgress({ done, total }),
        controller.signal
      );
      const next = new ImageData(result.rgba, result.width, result.height);
      const encoded = await encodeImageData(next, mimeType);
      setProgress(null);
      setIsRunning(false);
      onCommit(encoded);
      setTargetWidth(result.width);
      setTargetHeight(result.height);
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
      />
      <FloatingToolbar>
        <NumberField
          label="W"
          value={targetWidth}
          onCommit={(v) => setTargetWidth(Math.max(imageData.width, v))}
        />
        <NumberField
          label="H"
          value={targetHeight}
          onCommit={(v) => setTargetHeight(Math.max(imageData.height, v))}
        />
        <p className="max-w-48 text-[11px] text-muted-foreground">
          Your photo stays centered and unchanged -- the new space is filled with matching texture.
        </p>

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
            disabled={!hasChange}
          >
            Apply
          </Button>
        )}
      </FloatingToolbar>
    </div>
  );
}
