import { useState } from 'react';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';
import cn from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import { useCloudflareSettings } from '@renderer/hooks/useCloudflareSettings';
import { computeGenerationSize, MAX_DIMENSION, MIN_DIMENSION } from '../lib/generationSize';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { NumberField } from './NumberField';
import type { ToolPanelProps } from '../types';

function clampDimension(value: number): number {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

/**
 * Text-to-image (and, with "Edit this image" on, image-conditioned editing) via Cloudflare
 * Workers AI FLUX.2 [klein] (see `src/main/image-editor`). Editing mode sends the current
 * `binary` along as a reference image, so the model restyles/edits it instead of generating from
 * scratch -- otherwise this ignores the incoming pixels entirely. Either way the main process
 * re-encodes the result to the file's own `mimeType`, so `onCommit` is a drop-in replacement for
 * the current binary just like Resize/Crop's.
 */
export function GenerativeTool({
  imageData,
  binary,
  mimeType,
  onCommit,
  zoom,
  onZoomChange,
  onEffectiveZoomChange,
  pan,
  onPanChange
}: ToolPanelProps) {
  const { isLoading, configured } = useCloudflareSettings();
  const [prompt, setPrompt] = useState('');
  // Opening this tool always means there's already an image loaded, so default to editing it
  // rather than generating from scratch -- the more common case is refining what's already there.
  const [useReference, setUseReference] = useState(true);
  // Ticked: compute width/height from the current image's own aspect ratio at generate time (see
  // `computeGenerationSize`), so the result comes back shaped like the image it's replacing.
  // Unticked: send whatever the user typed into the W/H fields below instead.
  const [keepRatio, setKeepRatio] = useState(true);
  const initialSize = computeGenerationSize(imageData.width, imageData.height);
  const [customWidth, setCustomWidth] = useState(initialSize.width);
  const [customHeight, setCustomHeight] = useState(initialSize.height);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(): Promise<void> {
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      const size = keepRatio
        ? computeGenerationSize(imageData.width, imageData.height)
        : { width: customWidth, height: customHeight };
      const result = await window.imageEditor.generate(
        prompt,
        mimeType,
        useReference ? binary : undefined,
        size.width,
        size.height
      );
      if ('error' in result) throw new Error(result.error);
      onCommit(new Uint8Array(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
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

      <FloatingToolbar className="w-full max-w-lg flex-col items-stretch">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder={
            useReference ? 'Describe how to edit this image…' : 'Describe the image to generate…'
          }
          disabled={isRunning || !configured}
          className="w-full resize-none rounded-md border border-border bg-surface p-2 text-xs text-foreground focus-visible:outline-none disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUseReference((v) => !v)}
              disabled={isRunning || !configured}
              aria-pressed={useReference}
              className={cn(
                'flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] disabled:opacity-50',
                useReference
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted-foreground hover:bg-surface-3'
              )}
            >
              <ImagePlus size={13} strokeWidth={1.75} />
              Edit this image
            </button>

            <label className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={keepRatio}
                onChange={(e) => setKeepRatio(e.target.checked)}
                disabled={isRunning || !configured}
                className="accent-accent"
              />
              Keep ratio
            </label>

            {!keepRatio && (
              <div className="flex items-center rounded border border-border">
                <NumberField
                  label="W"
                  value={customWidth}
                  onCommit={(v) => setCustomWidth(clampDimension(v))}
                />
                <NumberField
                  label="H"
                  value={customHeight}
                  onCommit={(v) => setCustomHeight(clampDimension(v))}
                />
              </div>
            )}

            {error ? (
              <span className="text-[11px] text-red-500">{error}</span>
            ) : (
              !isLoading &&
              !configured && (
                <span className="text-[11px] text-muted-foreground">
                  Connect Cloudflare (Home tab) to generate images.
                </span>
              )
            )}
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleGenerate()}
            disabled={isRunning || !configured || !prompt.trim()}
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {isRunning ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </FloatingToolbar>
    </div>
  );
}
