import type React from 'react';
import { useEffect, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, Cloud, FlaskConical, Trash2, User } from 'lucide-react';
import cn from 'cnfast';
import { useProfilesStore } from '../../store/profiles.store';
import type { ProfileDescriptor } from '../../../../preload/store/types';
import { GithubLoginDialog } from '../auth/GithubLoginDialog';

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
  const { profiles, activeProfileId, isLoaded, error, load, switchProfile, deleteProfile } =
    useProfilesStore();
  const [open, setOpen] = useState(false);
  const [showGithubDialog, setShowGithubDialog] = useState(false);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const initial = activeProfile?.name.trim().charAt(0).toUpperCase() || '?';

  const handleRemoveProfile = (profile: ProfileDescriptor): void => {
    const confirmed = window.confirm(
      `Remove profile "${profile.name}"? This deletes its local data and can't be undone.`
    );
    if (!confirmed) return;
    void deleteProfile(profile.id);
  };

  return (
    <>
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
            <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-1.5 w-56 flex flex-col gap-0.5 text-sm outline-none">
              <span className="px-2 py-1 font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                Profiles
              </span>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={cn(
                    'group flex items-center gap-0.5 rounded',
                    profile.id === activeProfileId ? 'bg-surface-2' : 'hover:bg-surface-2'
                  )}
                >
                  <button
                    onClick={() => {
                      if (profile.id !== activeProfileId) switchProfile(profile.id);
                      setOpen(false);
                    }}
                    className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 rounded text-left cursor-pointer"
                  >
                    <span className="text-zinc-500 shrink-0">{kindIcon(profile.kind)}</span>
                    <span className="flex-1 truncate text-zinc-200">{profile.name}</span>
                    {profile.id === activeProfileId && (
                      <Check size={12} className="text-accent shrink-0" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemoveProfile(profile)}
                    title={`Remove "${profile.name}"`}
                    className="mr-1 shrink-0 rounded p-1 text-zinc-500 opacity-0 cursor-pointer transition-opacity hover:bg-surface-3 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <div className="my-0.5 border-t border-border" />
              <button
                onClick={() => {
                  setOpen(false);
                  setShowGithubDialog(true);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-left cursor-pointer hover:bg-surface-2"
              >
                <Cloud size={11} className="text-zinc-500 shrink-0" />
                <span className="flex-1 truncate text-zinc-200">Sign in with GitHub…</span>
              </button>
              {error && (
                <p className="px-2 py-1 text-[10px] text-red-400 leading-relaxed">{error}</p>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <GithubLoginDialog open={showGithubDialog} onOpenChange={setShowGithubDialog} />
    </>
  );
};
