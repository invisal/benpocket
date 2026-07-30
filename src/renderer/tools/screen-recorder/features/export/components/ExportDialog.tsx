import { useState, type JSX, type ReactNode } from 'react';
import { Clapperboard, Copy, Download, Maximize2, SlidersHorizontal, Timer, X } from 'lucide-react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Select } from '@renderer/components/ui/Select';
import { Button } from '@renderer/components/ui/Button';
import { Tabs } from '@renderer/components/ui/Tabs';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { useExportStore } from '../store/export-store';
import { useExportAction } from '../hooks/useExportAction';
import { estimateExport } from '../lib/estimate-export';

const FORMAT_CHOICES: { format: 'mp4' | 'gif'; label: string }[] = [
  { format: 'mp4', label: 'MP4' },
  { format: 'gif', label: 'GIF' }
];

const FRAME_RATE_CHOICES = [24, 30, 60];

const OUTPUT_SIZE_CHOICES: {
  label: string;
  resolution: { width: number; height: number };
}[] = [
  { label: '720p', resolution: { width: 1280, height: 720 } },
  { label: '1080p', resolution: { width: 1920, height: 1080 } },
  { label: '4K', resolution: { width: 3840, height: 2160 } }
];

/**
 * Quality is independent of Output Size here (unlike the old popover's
 * combined tiers) -- the store already treats `resolution`/`quality` as
 * separate fields, so this just exposes that directly instead of bundling
 * them back together.
 */
const QUALITY_CHOICES: { quality: number; label: string; description: string }[] = [
  {
    quality: 95,
    label: 'Master',
    description:
      'Highest quality, best for further editing. Compression is almost impossible to notice.'
  },
  {
    quality: 75,
    label: 'Social Media',
    description:
      'Great quality for sharing on social platforms, with a noticeably smaller file size.'
  },
  {
    quality: 50,
    label: 'Web',
    description: 'Balanced quality and file size, good for uploading to the web.'
  },
  {
    quality: 25,
    label: 'Web (Low)',
    description:
      'Smallest file size with noticeable compression -- quick previews, slow connections.'
  }
];

function longEdgeOf(resolution: { width: number; height: number }): number {
  return Math.max(resolution.width, resolution.height);
}

function closestByLongEdge<T extends { resolution: { width: number; height: number } }>(
  choices: T[],
  value: number
): T {
  return choices.reduce((closest, choice) =>
    Math.abs(longEdgeOf(choice.resolution) - value) <
    Math.abs(longEdgeOf(closest.resolution) - value)
      ? choice
      : closest
  );
}

function closestByQuality<T extends { quality: number }>(choices: T[], value: number): T {
  return choices.reduce((closest, choice) =>
    Math.abs(choice.quality - value) < Math.abs(closest.quality - value) ? choice : closest
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function ExportDialogButton({ disabled }: { disabled?: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const store = useExportStore();
  const { status, error, progress, canExport, handleExport, handleCopyToClipboard, handleCancel } =
    useExportAction();
  const isExporting = status === 'exporting';

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const durationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);

  const selectedOutputSize = closestByLongEdge(
    OUTPUT_SIZE_CHOICES,
    Math.max(store.resolution.width, store.resolution.height)
  );
  const selectedQuality = closestByQuality(QUALITY_CHOICES, store.quality);

  const estimate = estimateExport({
    durationMs,
    width: store.resolution.width,
    height: store.resolution.height,
    frameRate: store.frameRate,
    quality: store.quality,
    includeAudio: store.includeAudio,
    format: store.format
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // Export settings (and an in-progress export) shouldn't vanish from
        // a stray click outside the dialog or an accidental Escape -- only a
        // deliberate close (X, Cancel, or a completed export) dismisses it.
        if (!next && (details.reason === 'outside-press' || details.reason === 'escape-key'))
          return;
        setOpen(next);
      }}
    >
      <Dialog.Trigger
        disabled={disabled || !canExport}
        title={disabled || !canExport ? 'Record something first' : undefined}
      >
        <Button variant="secondary" size="sm">
          <Download size={13} />
          Export
        </Button>
      </Dialog.Trigger>

      <Dialog.Content size="large" showClose={!isExporting}>
        <div className="grid grid-cols-2 gap-6">
          <Field icon={<Clapperboard size={13} />} label="Export as">
            <Tabs.Root
              value={store.format}
              onValueChange={(value) => {
                const format = value as 'mp4' | 'gif';
                store.setFormat(format);
                if (format === 'mp4') store.setCodec('h264');
              }}
            >
              <Tabs.List>
                {FORMAT_CHOICES.map((choice) => (
                  <Tabs.Tab key={choice.format} value={choice.format} disabled={isExporting}>
                    {choice.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.Root>
          </Field>

          <Field icon={<Timer size={13} />} label="Frame rate">
            <Select.Root
              value={String(store.frameRate)}
              onValueChange={(value) => store.setFrameRate(Number(value))}
            >
              <Select.Trigger size="sm" disabled={isExporting} className="w-full justify-between">
                {store.frameRate} FPS
              </Select.Trigger>
              <Select.Content>
                {FRAME_RATE_CHOICES.map((fps) => (
                  <Select.Item key={fps} value={String(fps)}>
                    {fps} FPS
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-6">
          <Field icon={<Maximize2 size={13} />} label="Output Size">
            <div className="grid grid-cols-3 gap-1.5">
              {OUTPUT_SIZE_CHOICES.map((choice) => (
                <Button
                  key={choice.label}
                  size="sm"
                  variant={selectedOutputSize.label === choice.label ? 'primary' : 'outline'}
                  disabled={isExporting}
                  onClick={() => store.setResolution(choice.resolution)}
                  className="justify-center"
                >
                  {choice.label}
                </Button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {store.resolution.width}px × {store.resolution.height}px
            </p>
          </Field>

          <Field icon={<SlidersHorizontal size={13} />} label="Quality (Compression level)">
            <Tabs.Root
              value={selectedQuality.label}
              onValueChange={(value) => {
                const choice = QUALITY_CHOICES.find((c) => c.label === value);
                if (choice) store.setQuality(choice.quality);
              }}
            >
              <Tabs.List>
                {QUALITY_CHOICES.map((choice) => (
                  <Tabs.Tab key={choice.label} value={choice.label} disabled={isExporting}>
                    {choice.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.Root>
            <p className="mt-1.5 text-xs text-muted-foreground">{selectedQuality.description}</p>
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4">
          {status === 'error' && error && <p className="text-xs text-danger">{error}</p>}

          {isExporting && progress ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{progress.stage}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleCancel}
                className="w-full justify-center py-1.5 text-xs"
              >
                <X size={13} />
                Cancel export
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleExport}
                className="flex-1 justify-center gap-1.5"
              >
                <Download size={13} />
                Export to file
              </Button>
              <Button
                variant="secondary"
                onClick={handleCopyToClipboard}
                className="flex-1 justify-center gap-1.5"
              >
                <Copy size={13} />
                Copy to clipboard
              </Button>
              <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
            </div>
          )}

          {!isExporting && (
            <div className="text-xs text-muted-foreground">
              <p>Estimated export time — {formatSeconds(estimate.timeSeconds)}</p>
              <p>Estimated max output size — {formatBytes(estimate.fileSizeBytes)}</p>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function Field({
  icon,
  label,
  children
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
