import type React from 'react';
import { useEffect, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, Cloud, FlaskConical, FolderOpen, Plus, User } from 'lucide-react';
import cn from 'cnfast';
import { useProfilesStore } from '../../store/profiles.store';
import type { ProfileDescriptor } from '../../../../preload/store/types';

/** Basename without extension, used as a default profile name for a picked mock-server file. */
function fileNameToProfileName(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  return base.replace(/\.[^./\\]+$/, '') || 'Mock Remote';
}

function kindIcon(kind: ProfileDescriptor['kind']): React.ReactNode {
  switch (kind) {
    case 'remote':
      return <Cloud size={11} />;
    case 'mock-remote':
      return <FlaskConical size={11} />;
    case 'local':
      return <User size={11} />;
  }
}

export const ProfileSwitcher: React.FC = () => {
  const { profiles, activeProfileId, isLoaded, error, load, switchProfile, createProfile } =
    useProfilesStore();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const initial = activeProfile?.name.trim().charAt(0).toUpperCase() || '?';

  // __DEV__ only: mock-remote profiles fake a remote backend via a second
  // local sqlite file instead of a live server, so sync flows can be
  // exercised without one. Pick where that file lives, then create the
  // profile against it -- picking an existing file another mock-remote
  // profile already uses simulates "two devices, one account".
  const handleAddMockProfile = async (mode: 'create' | 'open'): Promise<void> => {
    const path = await window.profiles.pickMockServerFile(mode);
    if (!path) return;
    setIsCreating(true);
    try {
      await createProfile(fileNameToProfileName(path), {
        kind: 'mock-remote',
        mockServerDbFile: path
      });
    } finally {
      setIsCreating(false);
    }
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="size-11 flex items-center justify-center cursor-pointer transition-colors hover:bg-surface-2 outline-none"
        title={activeProfile?.name ?? 'Profile'}
      >
        <span className="size-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
          {initial}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="right" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-1.5 w-56 flex flex-col gap-0.5 text-xs outline-none">
            <span className="px-2 py-1 font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
              Profiles
            </span>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  if (profile.id !== activeProfileId) switchProfile(profile.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-left cursor-pointer',
                  profile.id === activeProfileId ? 'bg-surface-2' : 'hover:bg-surface-2'
                )}
              >
                <span className="text-zinc-500 shrink-0">{kindIcon(profile.kind)}</span>
                <span className="flex-1 truncate text-zinc-200">{profile.name}</span>
                {profile.id === activeProfileId && (
                  <Check size={12} className="text-accent shrink-0" />
                )}
              </button>
            ))}
            {import.meta.env.DEV && (
              <>
                <div className="my-0.5 border-t border-border" />
                <span className="px-2 py-1 font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                  Mock Remote (Dev)
                </span>
                <button
                  onClick={() => handleAddMockProfile('create')}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-left cursor-pointer hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus size={11} className="text-zinc-500 shrink-0" />
                  <span className="flex-1 truncate text-zinc-200">New Mock Sync File...</span>
                </button>
                <button
                  onClick={() => handleAddMockProfile('open')}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-left cursor-pointer hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <FolderOpen size={11} className="text-zinc-500 shrink-0" />
                  <span className="flex-1 truncate text-zinc-200">Open Mock Sync File...</span>
                </button>
              </>
            )}
            {error && <p className="px-2 py-1 text-[10px] text-red-400 leading-relaxed">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
