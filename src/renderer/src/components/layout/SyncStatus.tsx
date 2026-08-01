import type React from 'react';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import cn from 'cnfast';
import { Popover } from '../ui/Popover';
import { Button } from '../ui/Button';
import { useSyncStore } from '../../store/sync.store';
import { useProfilesStore } from '../../store/profiles.store';

export const SyncStatus: React.FC = () => {
  const { profiles, activeProfileId, error: profileError, deleteProfile } = useProfilesStore();
  const { unpushedCount, isSyncing, error: syncError, refresh, sync } = useSyncStore();
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;

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

  const handleRemoveProfile = (): void => {
    if (!activeProfile) return;
    const confirmed = window.confirm(
      `Remove profile "${activeProfile.name}"? This deletes its local data and can't be undone.`
    );
    if (!confirmed) return;
    void deleteProfile(activeProfile.id);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex h-full items-center gap-1.5 px-2.5 text-xs text-muted-foreground outline-none',
          'hover:bg-surface-2 hover:text-foreground'
        )}
      >
        <RefreshCw size={12} className={cn(isSyncing && 'animate-spin')} />
        {unpushedCount} uncommit{unpushedCount === 1 ? '' : 's'} | Sync
      </Popover.Trigger>

      <Popover.Content side="top" align="end" className="w-64 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Sync</span>
          <span className="text-muted-foreground">
            {unpushedCount} uncommitted patch{unpushedCount === 1 ? '' : 'es'}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Pushes local changes to this profile&apos;s remote and pulls down anything new. A no-op
          for local-only profiles.
        </p>
        {syncError && <p className="text-[11px] leading-relaxed text-red-400">{syncError}</p>}
        <Button size="sm" onClick={() => void sync()} disabled={isSyncing} className="w-full">
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </Button>

        <div className="border-t border-border pt-2.5">
          {profileError && (
            <p className="mb-2 text-[11px] leading-relaxed text-red-400">{profileError}</p>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRemoveProfile}
            disabled={!activeProfile}
            className="w-full"
          >
            Remove profile
          </Button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
