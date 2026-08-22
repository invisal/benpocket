import { useEffect, useState } from 'react';
import { Loader2, ZoomIn } from 'lucide-react';
import cn from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import type { ToolPanelProps } from '../types';

// Mirrors the literal strings the main process rejects with when `cancelUpscale()` interrupts an
// in-flight download/inference (see src/main/image-editor/upscale/{modelCache,infer}.ts) -- not
// imported from there since renderer code never bundles main/preload sources (see docs/receipts).
const UPSCALE_CANCELLED_MESSAGE = 'upscale cancelled';
const MODEL_DOWNLOAD_CANCELLED_MESSAGE = 'model download cancelled';

interface UpscaleModelStatus {
  id: 'x4v3' | 'x4plus';
  label: string;
  description: string;
  scale: number;
  downloadSizeBytes: number;
  cached: boolean;
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upscales the image via a local ONNX model (Real-ESRGAN, see `src/main/image-editor/upscale/`
 * -- runs entirely in the main process through onnxruntime-node, same round-trip shape as
 * Resize/Crop). The chosen model's weights are downloaded to the userData model cache on first
 * use; `getUpscaleModels` reports which one(s) are already cached so repeat runs skip straight to
 * inference. The network itself is fixed-ratio (`model.scale`, e.g. 4x); the scale slider below
 * that just asks the main process to downsample its native-ratio output, so any value from 1x up
 * to the model's native scale is available, not only the network's own ratio.
 */
export function UpscaleTool({
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
  const [models, setModels] = useState<UpscaleModelStatus[] | null>(null);
  const [selectedId, setSelectedId] = useState<'x4v3' | 'x4plus'>('x4v3');
  // Defaults to the network's native ratio (4x) -- lower values just downsample that native
  // result in the same round trip (see `image-editor:upscale`'s handler), not a smaller model run.
  const [scale, setScale] = useState(4);
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'upscaling'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.imageEditor.getUpscaleModels().then((list) => {
      if (!cancelled) setModels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const offDownload = window.imageEditor.onUpscaleDownloadProgress(({ modelId, percent }) => {
      if (modelId === selectedId) setProgress({ done: percent, total: 100 });
    });
    const offUpscale = window.imageEditor.onUpscaleProgress(({ done, total }) => {
      setProgress({ done, total });
    });
    return () => {
      offDownload();
      offUpscale();
    };
  }, [selectedId]);

  // Stop any in-flight download/inference if the user switches away to another tool mid-run.
  useEffect(() => {
    return () => {
      void window.imageEditor.cancelUpscale();
    };
  }, []);

  const selected = models?.find((m) => m.id === selectedId);
  const isRunning = phase !== 'idle';
  const maxScale = selected?.scale ?? 4;
  const clampedScale = Math.min(scale, maxScale);

  async function handleApply(): Promise<void> {
    setError(null);
    try {
      if (!selected?.cached) {
        setPhase('downloading');
        setProgress({ done: 0, total: 100 });
        const result = await window.imageEditor.ensureUpscaleModel(selectedId);
        if (result.error) throw new Error(result.error);
        setModels(
          (prev) => prev?.map((m) => (m.id === selectedId ? { ...m, cached: true } : m)) ?? prev
        );
      }

      setPhase('upscaling');
      setProgress({ done: 0, total: 1 });
      const result = await window.imageEditor.upscale(binary, mimeType, selectedId, clampedScale);
      if ('error' in result) throw new Error(result.error);
      onCommit(new Uint8Array(result.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== UPSCALE_CANCELLED_MESSAGE && message !== MODEL_DOWNLOAD_CANCELLED_MESSAGE) {
        setError(message);
      }
    } finally {
      setPhase('idle');
      setProgress(null);
    }
  }

  function handleCancel(): void {
    void window.imageEditor.cancelUpscale();
  }

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

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

      <FloatingToolbar className="w-full max-w-md flex-col items-stretch">
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {models === null ? (
            <div className="flex flex-1 items-center justify-center py-1 text-[11px] text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
            </div>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelectedId(model.id)}
                disabled={isRunning}
                aria-pressed={selectedId === model.id}
                className={cn(
                  'flex-1 rounded px-2 py-1 text-[11px] disabled:opacity-50',
                  selectedId === model.id
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted-foreground hover:bg-surface-3'
                )}
              >
                {model.label}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Scale</span>
          <input
            type="range"
            min={1}
            max={maxScale}
            step={0.25}
            value={clampedScale}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={isRunning}
            className="w-24 accent-accent"
          />
          <span className="w-9 text-[11px] tabular-nums text-muted-foreground">
            {clampedScale.toFixed(2).replace(/\.?0+$/, '')}x
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            {selected &&
              (selected.cached
                ? `Upscales to ${Math.round(imageData.width * clampedScale)}x${Math.round(imageData.height * clampedScale)}.`
                : `${selected.description} Downloads ${formatMB(selected.downloadSizeBytes)} on first use.`)}
            {phase === 'downloading' && ` Downloading model… ${percent}%`}
            {phase === 'upscaling' &&
              progress &&
              ` Upscaling… tile ${progress.done}/${progress.total}`}
          </div>

          {isRunning ? (
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void handleApply()}
              disabled={!selected}
            >
              <ZoomIn size={12} />
              Upscale
            </Button>
          )}
        </div>

        {isRunning && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        )}

        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </FloatingToolbar>
    </div>
  );
}
