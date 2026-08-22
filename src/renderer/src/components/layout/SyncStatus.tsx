import type React from 'react';
import { useEffect } from 'react';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import cn from 'cnfast';
import { Popover } from '../ui/Popover';
import { Button } from '../ui/Button';
import { useSyncStore } from '../../store/sync.store';
import { useProfilesStore } from '../../store/profiles.store';

export const SyncStatus: React.FC = () => {
  const {
    unpushedCount,
    isSyncing,
    error: syncError,
    remoteStatus,
    isCheckingStatus,
    statusError,
    isCompacting,
    compactError,
    refresh,
    checkStatus,
    sync,
    compact
  } = useSyncStore();
  const activeProfile = useProfilesStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId)
  );
  // One-time fetch of the current value on mount.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates after that: main pushes the active profile's unpushed count
  // after every appendPatch/sync/switchProfile/delete (see
  // src/main/store/ipc.ts's broadcastUnpushedCount) -- this status bar item
  // is always mounted, so subscribing here (rather than at zustand-store
  // module scope) keeps exactly one ipcRenderer listener alive, cleaned up
  // the normal React way instead of leaking across Vite HMR reloads.
  useEffect(() => {
    return window.profiles.onUnpushedCountChanged((unpushedCount) => {
      useSyncStore.setState({ unpushedCount });
    });
  }, []);

  if (activeProfile?.kind === 'local') return null;

  const behindCount = remoteStatus?.count ?? 0;
  const hasLocalChanges = unpushedCount > 0;
  const hasRemoteChanges = behindCount > 0;
  const isUpToDate = !hasLocalChanges && !hasRemoteChanges;

  return (
    <Popover.Root
      onOpenChange={(open) => {
        // Cheap remote precheck each time the popover opens, so "N changes
        // available" reflects reality instead of whatever was last fetched.
        if (open) void checkStatus();
      }}
    >
      <Popover.Trigger
        className={cn(
          'flex h-full items-center gap-1.5 px-4 text-sm text-muted-foreground outline-none',
          'hover:bg-surface-2 hover:text-foreground'
        )}
      >
        <ArrowUpDownIcon size={12} className={cn(isSyncing && 'animate-spin')} />
        <span>Sync</span>
      </Popover.Trigger>

      <Popover.Content side="top" align="end" className="w-64 flex flex-col gap-2.5 text-sm">
        {statusError && <p className="text-[11px] leading-relaxed text-red-400">{statusError}</p>}

        <h2 className="font-medium">
          {isUpToDate ? 'Everything is synced' : 'Changes need to be synced'}
        </h2>
        <ul className="text-sm mb-2 gap-1 flex flex-col">
          <li className="flex items-center gap-2">
            <ArrowUpIcon
              size={14}
              className={hasLocalChanges ? 'text-blue-500' : 'text-muted-foreground'}
            />
            <span>
              {hasLocalChanges
                ? `${unpushedCount} local change${unpushedCount === 1 ? '' : 's'} waiting to push`
                : 'No local changes to push'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <ArrowDownIcon
              size={14}
              className={hasRemoteChanges ? 'text-green-500' : 'text-muted-foreground'}
            />
            <span>
              {isCheckingStatus && remoteStatus === null
                ? 'Checking remote…'
                : hasRemoteChanges
                  ? `${behindCount} change${behindCount === 1 ? '' : 's'} behind remote`
                  : 'Up to date with remote'}
            </span>
          </li>
        </ul>

        {syncError && <p className="text-[11px] leading-relaxed text-red-400">{syncError}</p>}
        {compactError && <p className="text-[11px] leading-relaxed text-red-400">{compactError}</p>}

        <Button
          variant="primary"
          size="sm"
          onClick={() => void sync()}
          disabled={isSyncing}
          className="w-full"
        >
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </Button>

        {activeProfile?.kind === 'remote' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void compact()}
            disabled={isCompacting}
            className="w-full"
          >
            {isCompacting ? 'Compacting...' : 'Compact'}
          </Button>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};
