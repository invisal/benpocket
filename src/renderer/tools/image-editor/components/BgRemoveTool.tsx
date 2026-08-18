import { useEffect, useState } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import cn from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import type { ToolPanelProps } from '../types';

// Mirrors the literal strings the main process rejects with when `cancelBgRemove()` interrupts an
// in-flight download/inference (see src/main/image-editor/bg-remove/{modelCache,infer}.ts) -- not
// imported from there since renderer code never bundles main/preload sources (see docs/receipts).
const BG_REMOVE_CANCELLED_MESSAGE = 'background removal cancelled';
const MODEL_DOWNLOAD_CANCELLED_MESSAGE = 'model download cancelled';

interface BgRemoveModelStatus {
  id: 'u2netp' | 'isnet-general-use';
  label: string;
  description: string;
  downloadSizeBytes: number;
  cached: boolean;
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Cuts the background out via a local ONNX saliency model (U²-Net-p / IS-Net, see
 * `src/main/image-editor/bg-remove/` -- runs entirely in the main process through
 * onnxruntime-node, same round-trip shape as Upscale). The chosen model's weights are downloaded
 * to the userData model cache on first use; `getBgRemoveModels` reports which one(s) are already
 * cached so repeat runs skip straight to inference. Unlike Upscale there's no per-tile progress --
 * the network sees the whole image in one pass -- so only the download has a percent bar.
 */
export function BgRemoveTool({ imageData, binary, mimeType, onCommit }: ToolPanelProps) {
  const [models, setModels] = useState<BgRemoveModelStatus[] | null>(null);
  const [selectedId, setSelectedId] = useState<'u2netp' | 'isnet-general-use'>('u2netp');
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'removing'>('idle');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.imageEditor.getBgRemoveModels().then((list) => {
      if (!cancelled) setModels(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.imageEditor.onBgRemoveDownloadProgress(({ modelId, percent }) => {
      if (modelId === selectedId) setDownloadPercent(percent);
    });
  }, [selectedId]);

  // Stop any in-flight download/inference if the user switches away to another tool mid-run.
  useEffect(() => {
    return () => {
      void window.imageEditor.cancelBgRemove();
    };
  }, []);

  const selected = models?.find((m) => m.id === selectedId);
  const isRunning = phase !== 'idle';
  const isJpeg = mimeType === 'image/jpeg';

  async function handleApply(): Promise<void> {
    setError(null);
    try {
      if (!selected?.cached) {
        setPhase('downloading');
        setDownloadPercent(0);
        const result = await window.imageEditor.ensureBgRemoveModel(selectedId);
        if (result.error) throw new Error(result.error);
        setModels(
          (prev) => prev?.map((m) => (m.id === selectedId ? { ...m, cached: true } : m)) ?? prev
        );
      }

      setPhase('removing');
      const result = await window.imageEditor.removeBackground(binary, mimeType, selectedId);
      if ('error' in result) throw new Error(result.error);
      onCommit(new Uint8Array(result.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== BG_REMOVE_CANCELLED_MESSAGE && message !== MODEL_DOWNLOAD_CANCELLED_MESSAGE) {
        setError(message);
      }
    } finally {
      setPhase('idle');
      setDownloadPercent(0);
    }
  }

  function handleCancel(): void {
    void window.imageEditor.cancelBgRemove();
  }

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <ImageCanvas imageData={imageData} />

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

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            {selected &&
              (selected.cached
                ? 'Cuts out the background and makes it transparent.'
                : `${selected.description} Downloads ${formatMB(selected.downloadSizeBytes)} on first use.`)}
            {phase === 'downloading' && ` Downloading model… ${downloadPercent}%`}
            {phase === 'removing' && ' Removing background…'}
            {!isRunning &&
              isJpeg &&
              ' JPEG has no transparency -- the cutout will be flattened onto white.'}
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
              <Scissors size={12} />
              Remove
            </Button>
          )}
        </div>

        {phase === 'downloading' && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${downloadPercent}%` }}
            />
          </div>
        )}

        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </FloatingToolbar>
    </div>
  );
}
