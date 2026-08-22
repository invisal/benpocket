import type React from 'react';
import { useEffect, useState } from 'react';
import cn from 'cnfast';
import { Popover } from '../ui/Popover';
import type { AppProcessMetric } from '../../../../preload/system/api';

const POLL_INTERVAL_MS = 2000;

function kbToMb(kb: number): number {
  return kb / 1024;
}

function labelFor(metric: AppProcessMetric): string {
  if (metric.type === 'Browser') return 'Main';
  if (metric.type === 'Tab') return 'Renderer';
  return metric.name ?? metric.type;
}

export const MemoryStatus: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<AppProcessMetric[]>([]);

  // Refetch immediately on open, then keep polling while the popover is
  // visible so the numbers stay live without a manual refresh click.
  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const fetchMetrics = (): void => {
      void window.system.getAppMetrics().then((next) => {
        if (!cancelled) setMetrics(next);
      });
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  const sorted = [...metrics].sort((a, b) => b.workingSetSizeKb - a.workingSetSizeKb);
  const totalMb = sorted.reduce((sum, m) => sum + kbToMb(m.workingSetSizeKb), 0);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Doubles as the app name/version label -- the memory popover lives
          here instead of its own status bar segment, intentionally low-key
          rather than a dedicated "Memory" item. */}
      <Popover.Trigger
        className={cn('px-4 h-full flex items-center outline-none', 'hover:bg-surface-2')}
      >
        <span className="font-medium mr-1">benpocket</span>
        <span> v{__APP_VERSION__}</span>
      </Popover.Trigger>

      <Popover.Content side="top" align="start" className="w-72 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Process memory</h2>
          {sorted.length > 0 && (
            <span className="tabular-nums text-muted-foreground">
              {Math.round(totalMb)} MB total
            </span>
          )}
        </div>

        {sorted.length === 0 && <p className="text-muted-foreground">Loading...</p>}

        <div className="flex flex-col gap-1">
          {sorted.map((metric) => (
            <div key={metric.pid} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">
                {labelFor(metric)} <span className="opacity-60">#{metric.pid}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {Math.round(kbToMb(metric.workingSetSizeKb))} MB
              </span>
            </div>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
