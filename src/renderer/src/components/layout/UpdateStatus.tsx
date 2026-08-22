import type React from 'react';
import { useEffect, useState } from 'react';
import { CheckIcon, DownloadIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import cn from 'cnfast';
import { Popover } from '../ui/Popover';
import { Button } from '../ui/Button';
import { useUpdateStore } from '../../store/update.store';

export const UpdateStatus: React.FC = () => {
  const { status, refresh, check, update } = useUpdateStore();
  const [open, setOpen] = useState(false);

  // One-time fetch on mount, in case the startup check (see
  // src/main/updater/ipc.ts) already resolved before this component mounted.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates after that -- main pushes every autoUpdater event.
  useEffect(() => {
    return window.updater.onStatusChanged((nextStatus) => {
      useUpdateStore.setState({ status: nextStatus });
    });
  }, []);

  const canOpenPopover =
    status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded';

  const handleTriggerClick = (): void => {
    if (canOpenPopover) {
      setOpen(true);
      return;
    }
    // idle / not-available / error: re-check instead of opening a popover.
    // 'checking' falls through here too but is a harmless no-op re-check.
    if (status.state !== 'checking') void check();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        onClick={handleTriggerClick}
        title={status.state === 'error' ? status.message : undefined}
        className={cn(
          'flex h-full items-center gap-1.5 px-4 text-sm text-muted-foreground outline-none',
          'hover:bg-surface-2 hover:text-foreground'
        )}
      >
        {status.state === 'checking' && <RefreshCwIcon size={12} className="animate-spin" />}
        {status.state === 'downloading' && <DownloadIcon size={12} />}
        {status.state === 'available' && <SparklesIcon size={12} className="text-blue-500" />}
        {(status.state === 'idle' ||
          status.state === 'not-available' ||
          status.state === 'downloaded') && <CheckIcon size={12} />}
        {status.state === 'error' && <RefreshCwIcon size={12} />}

        <span>
          {status.state === 'idle' && 'Check for Updates'}
          {status.state === 'checking' && 'Checking...'}
          {status.state === 'available' && 'Update available'}
          {status.state === 'not-available' && 'Up to date'}
          {status.state === 'downloading' && `Downloading... ${status.percent}%`}
          {status.state === 'downloaded' && 'Restarting...'}
          {status.state === 'error' && 'Update check failed'}
        </span>
      </Popover.Trigger>

      <Popover.Content side="top" align="end" className="w-64 flex flex-col gap-2.5 text-sm">
        {status.state === 'available' && (
          <>
            <h2 className="font-medium">Version {status.version} is available</h2>
            <Button variant="primary" size="sm" onClick={() => void update()} className="w-full">
              Update
            </Button>
          </>
        )}

        {status.state === 'downloading' && (
          <>
            <h2 className="font-medium">Downloading version {status.version}...</h2>
            <div className="h-1.5 w-full rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          </>
        )}

        {status.state === 'downloaded' && (
          <p>Update downloaded -- restarting to install version {status.version}...</p>
        )}

        {status.state === 'not-available' && (
          <p className="text-muted-foreground">
            You&apos;re on the latest version (v{__APP_VERSION__}).
          </p>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};
