import { create } from 'zustand';
import type { ProfileConfig, ProfileDescriptor, ProfileId } from '../../../preload/store/types';

interface ProfilesState {
  profiles: ProfileDescriptor[];
  activeProfileId: ProfileId | null;
  isLoaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  switchProfile: (profileId: ProfileId) => Promise<void>;
  /** Creates a profile and switches to it. Returns the created profile, or null if creation failed (see `error`). */
  createProfile: (name: string, config: ProfileConfig) => Promise<ProfileDescriptor | null>;
  /** Deletes a profile (refuses to delete the last local one). Returns whether it succeeded (see `error`). */
  deleteProfile: (profileId: ProfileId) => Promise<boolean>;
}

// Renderer-side cache of the main-process ProfileManager (source of truth --
// see src/main/store/profileManager.ts). Both the profile list and which one
// is active live in main, so unlike theme/layout there's nothing to persist
// here; load() is the only way this store's state changes.
export const useProfilesStore = create<ProfilesState>()((set, get) => ({
  profiles: [],
  activeProfileId: null,
  isLoaded: false,
  error: null,

  load: async () => {
    const [profiles, active] = await Promise.all([
      window.profiles.list(),
      window.profiles.getActive()
    ]);
    set({ profiles, activeProfileId: active.id, isLoaded: true });
  },

  switchProfile: async (profileId) => {
    const previous = get().activeProfileId;
    set({ activeProfileId: profileId, error: null });
    const result = await window.profiles.switch(profileId);
    if (!result.ok) {
      set({ activeProfileId: previous, error: result.error ?? 'Something went wrong.' });
      return;
    }
    await get().load();
  },

  createProfile: async (name, config) => {
    set({ error: null });
    const result = await window.profiles.create({ name, config });
    if (!result.ok) {
      set({ error: result.error ?? 'Something went wrong.' });
      return null;
    }
    await get().switchProfile(result.profile.id);
    return result.profile;
  },

  deleteProfile: async (profileId) => {
    set({ error: null });
    const result = await window.profiles.delete(profileId);
    if (!result.ok) {
      set({ error: result.error ?? 'Something went wrong.' });
      return false;
    }
    await get().load();
    return true;
  }
}));
