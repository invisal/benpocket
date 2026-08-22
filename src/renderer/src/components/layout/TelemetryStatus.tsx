import type React from 'react';
import { useEffect } from 'react';
import { ActivityIcon } from 'lucide-react';
import cn from 'cnfast';
import { Popover } from '../ui/Popover';
import { useTelemetryStore } from '../../store/telemetry.store';

export const TelemetryStatus: React.FC = () => {
  const { optIn, refresh, setOptIn } = useTelemetryStore();

  // One-time fetch of the current value on mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex h-full items-center gap-1.5 px-4 text-sm text-muted-foreground outline-none',
          'hover:bg-surface-2 hover:text-foreground'
        )}
      >
        <ActivityIcon size={12} className={optIn ? 'text-green-500' : undefined} />
        <span>{optIn ? 'Usage data' : 'Usage data off'}</span>
      </Popover.Trigger>

      <Popover.Content side="top" align="end" className="w-64 flex flex-col gap-2.5 text-sm">
        <h2 className="font-medium">Usage tracking</h2>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          We only send which tools get used -- never file paths, request content, or anything you
          type. Free to opt out anytime.
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={optIn}
          onClick={() => void setOptIn(!optIn)}
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-surface-2"
        >
          <span>Send usage data</span>
          <span
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
              optIn ? 'bg-accent' : 'bg-surface-4'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                optIn ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </span>
        </button>
      </Popover.Content>
    </Popover.Root>
  );
};
