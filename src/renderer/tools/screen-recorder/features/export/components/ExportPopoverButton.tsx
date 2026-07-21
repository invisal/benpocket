import { useState, type JSX, type ReactNode } from 'react';
import { Check, ChevronDown, Download, X } from 'lucide-react';
import { Popover } from '@renderer/components/ui/Popover';
import { Button } from '@renderer/components/ui/Button';
import { cn } from '../../../lib/utils';
import { useExportStore } from '../store/export-store';
import { useExportAction } from '../hooks/useExportAction';

const FORMAT_CHOICES: {
  format: 'mp4' | 'webm';
  label: string;
  description: string;
}[] = [
  { format: 'mp4', label: 'MP4 (H.264)', description: 'Better compatibility' },
  { format: 'webm', label: 'WebM (VP9)', description: 'Smaller file size' }
];

/**
 * Each tier bumps quality AND resolution together (matching the old preset
 * system, where e.g. "4K Master" meant 2160p + quality 90 -- quality alone
 * doesn't determine how an export looks, since bitrate is computed from
 * quality x resolution x frame rate; keeping resolution fixed while only
 * raising quality wouldn't actually look any sharper).
 */
const QUALITY_CHOICES: {
  quality: number;
  resolution: { width: number; height: number };
  label: string;
  description: string;
}[] = [
  {
    quality: 20,
    resolution: { width: 1280, height: 720 },
    label: 'Low',
    description: 'Smallest file size'
  },
  {
    quality: 50,
    resolution: { width: 1920, height: 1080 },
    label: 'Medium',
    description: 'Balanced'
  },
  {
    quality: 75,
    resolution: { width: 2560, height: 1440 },
    label: 'High',
    description: 'Recommended'
  },
  {
    quality: 95,
    resolution: { width: 3840, height: 2160 },
    label: 'Very high',
    description: 'Largest file size'
  }
];

/** Snaps a stored numeric 0-100 quality to whichever discrete tier reads closest, so exactly one option always shows selected. */
function closestQualityChoice(quality: number): (typeof QUALITY_CHOICES)[number] {
  return QUALITY_CHOICES.reduce((closest, choice) =>
    Math.abs(choice.quality - quality) < Math.abs(closest.quality - quality) ? choice : closest
  );
}

export function ExportPopoverButton(): JSX.Element {
  const [open, setOpen] = useState(false);
  const store = useExportStore();
  const { status, error, progress, canExport, handleExport, handleCancel } = useExportAction();
  const selectedQuality = closestQualityChoice(store.quality);
  const isExporting = status === 'exporting';

  return (
    <Popover.Root open={open} onOpenChange={(next) => !isExporting && setOpen(next)}>
      <Popover.Trigger
        disabled={!canExport}
        title={canExport ? undefined : 'Record something first'}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-30',
          open
            ? 'bg-accent/10 text-accent'
            : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
        )}
      >
        <Download size={13} />
        Export
      </Popover.Trigger>

      <Popover.Content side="bottom" align="end" className="w-72 p-0">
        <div className="border-b border-line px-3 py-2.5">
          <p className="text-sm font-semibold">Export project</p>
        </div>

        <Section title="Format">
          {FORMAT_CHOICES.map((choice) => (
            <RadioRow
              key={choice.format}
              label={choice.label}
              description={choice.description}
              selected={store.format === choice.format}
              disabled={isExporting}
              onClick={() => {
                store.setFormat(choice.format);
                if (choice.format === 'mp4') store.setCodec('h264');
              }}
            />
          ))}
        </Section>

        <Section title="Quality">
          {QUALITY_CHOICES.map((choice) => (
            <RadioRow
              key={choice.label}
              label={choice.label}
              description={choice.description}
              selected={selectedQuality.label === choice.label}
              disabled={isExporting}
              onClick={() => {
                store.setQuality(choice.quality);
                store.setResolution(choice.resolution);
              }}
            />
          ))}
        </Section>

        <Section title="Audio">
          <CheckboxRow
            label="Include audio in export"
            checked={store.includeAudio}
            disabled={isExporting}
            onClick={() => store.setIncludeAudio(!store.includeAudio)}
          />
        </Section>

        <div className="flex flex-col gap-2 p-3">
          {status === 'error' && error && <p className="text-xs text-danger">{error}</p>}

          {isExporting && progress && (
            <div className="flex flex-col gap-1.5">
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
            </div>
          )}

          {isExporting ? (
            <Button
              variant="secondary"
              onClick={handleCancel}
              className="w-full justify-center py-1.5 text-xs"
            >
              <X size={13} />
              Cancel export
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleExport}
              className="w-full justify-center py-1.5 text-xs"
            >
              Export
            </Button>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-line px-3 py-2.5">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-medium"
      >
        {title}
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="mt-2 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

function RadioRow({
  label,
  description,
  selected,
  disabled,
  onClick
}: {
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 rounded-lg py-1 text-left disabled:opacity-50"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-accent bg-accent' : 'border-line'
        )}
      />
      <span className="text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground"> - {description}</span>
      </span>
    </button>
  );
}

function CheckboxRow({
  label,
  checked,
  disabled,
  onClick
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 rounded-lg py-1 text-left disabled:opacity-50"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
          checked ? 'border-accent bg-accent text-surface' : 'border-line'
        )}
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="text-xs text-foreground">{label}</span>
    </button>
  );
}
