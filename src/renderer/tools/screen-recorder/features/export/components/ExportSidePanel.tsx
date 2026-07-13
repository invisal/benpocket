import type { JSX } from 'react';
import { Check } from 'lucide-react';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useExportStore } from '../store/export-store';
import { useExportAction } from '../hooks/useExportAction';
import { estimateExportSize } from '../engine/estimate-size';
import {
  CODEC_OPTIONS,
  EXPORT_PRESETS,
  FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  RESOLUTION_OPTIONS,
  qualityLabel
} from '../presets';
import { cn } from '../../../lib/utils';
import { Button } from '@renderer/components/ui/Button';

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportSidePanel(): JSX.Element {
  const store = useExportStore();
  const originalSizeBytes = useAppStore((state) => state.lastRecording?.sizeBytes ?? 0);
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const durationSeconds =
    segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0) / 1000;

  const estimate = estimateExportSize({
    originalSizeBytes,
    durationSeconds,
    resolution: store.resolution,
    frameRate: store.frameRate,
    codec: store.codec,
    quality: store.quality
  });

  return (
    <aside className="flex w-70 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface-sunken p-4">
      {/* Estimated output */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Estimated output
          </span>
          {estimate.reductionPercent > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
              −{estimate.reductionPercent}%
            </span>
          )}
        </div>

        <div>
          <p className="font-mono text-2xl font-bold">{formatMb(estimate.estimatedBytes)}</p>
          <p className="text-xs text-white/40">
            from {formatMb(originalSizeBytes)} · {Math.round(durationSeconds)}s
          </p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.max(4, 100 - estimate.reductionPercent)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Bitrate" value={`${estimate.bitrateMbps.toFixed(1)} Mbps`} />
          <Stat label="Frame" value={`${store.resolution.width}×${store.resolution.height}`} />
          <Stat label="Rate" value={`${store.frameRate} fps`} />
        </div>
      </section>

      {/* Presets */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">Presets</span>
        <div className="grid grid-cols-2 gap-2">
          {EXPORT_PRESETS.map((preset) => {
            const isSelected = store.presetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => store.setPreset(preset.id)}
                className={cn(
                  'relative rounded-lg border p-2.5 text-left transition-colors',
                  isSelected ? 'border-accent bg-accent/10' : 'border-line hover:border-white/20'
                )}
              >
                {isSelected && (
                  <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-surface">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <p className="text-xs font-medium">{preset.label}</p>
                <p className="text-[11px] text-white/40">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Format */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">Format</span>
        <div className="grid grid-cols-4 gap-2">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => store.setFormat(option.id)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                store.format === option.id
                  ? 'border-accent text-accent'
                  : 'border-line text-white/60 hover:border-white/20'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Codec */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">Codec</span>
          <span className="text-xs text-white/30">smaller →</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CODEC_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => store.setCodec(option.id)}
              className={cn(
                'rounded-lg border py-1.5 text-center transition-colors',
                store.codec === option.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-white/70 hover:border-white/20'
              )}
            >
              <p className="text-xs font-medium">{option.label}</p>
              <p className="text-[10px] opacity-70">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Quality */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">Quality</span>
          <span className="text-xs font-medium text-accent">
            {qualityLabel(store.quality)} {store.quality}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={store.quality}
          onChange={(e) => store.setQuality(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-white/30">
          <span>Draft</span>
          <span>Balanced</span>
          <span>High</span>
          <span>Lossless</span>
        </div>
      </section>

      {/* Resolution / Frame rate */}
      <section className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Resolution
          </span>
          <select
            value={Math.max(store.resolution.width, store.resolution.height)}
            onChange={(e) => {
              const longEdge = Number(e.target.value);
              const option = RESOLUTION_OPTIONS.find((o) => o.width === longEdge);
              if (option) store.setResolution({ width: option.width, height: option.height });
            }}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs"
          >
            {/* `option`s are authored as 16:9 pairs (long edge x short edge) --
                the select always shows/picks by long edge ("quality tier"),
                and the store reshapes it to the current aspect ratio. */}
            {RESOLUTION_OPTIONS.map((option) => (
              <option key={option.label} value={option.width}>
                {option.label} {option.width}×{option.height}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-white/40">
            Frame rate
          </span>
          <select
            value={store.frameRate}
            onChange={(e) => store.setFrameRate(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-xs"
          >
            {FRAME_RATE_OPTIONS.map((fps) => (
              <option key={fps} value={fps}>
                {fps} fps
              </option>
            ))}
          </select>
        </div>
      </section>

      <ExportAction />
    </aside>
  );
}

function ExportAction(): JSX.Element {
  const { status, error, progress, handleExport } = useExportAction();

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
      {status === 'error' && error && <p className="text-xs text-red-400">{error}</p>}
      {status === 'exporting' && progress && (
        <p className="text-xs text-white/50">
          {progress.stage} · {progress.percent}%
        </p>
      )}
      <Button
        variant="primary"
        onClick={handleExport}
        disabled={status === 'exporting'}
        className="w-full justify-center py-1.5 text-xs"
      >
        {status === 'exporting' ? 'Exporting…' : 'Export'}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-white/30">{label}</p>
      <p className="font-mono text-xs text-white/80">{value}</p>
    </div>
  );
}
