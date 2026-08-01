import { create } from 'zustand';

interface SyncState {
  unpushedCount: number;
  isSyncing: boolean;
  error: string | null;
  /** Re-reads the active profile's unpushed patch count from main -- only needed for the initial value on mount; live updates arrive via SyncStatus's onUnpushedCountChanged subscription. */
  refresh: () => Promise<void>;
  /** Pushes/pulls through the active profile's SyncProvider. The resulting count arrives via that same push subscription, not a manual refetch. */
  sync: () => Promise<void>;
}

// Renderer-side cache of the active profile's unpushed-patch count (see
// src/main/store/profileManager.ts's getUnpushedPatchCount/sync) -- backs the
// status bar's sync indicator (src/renderer/src/components/layout/SyncStatus.tsx).
export const useSyncStore = create<SyncState>()((set) => ({
  unpushedCount: 0,
  isSyncing: false,
  error: null,

  refresh: async () => {
    const unpushedCount = await window.profiles.getUnpushedCount();
    set({ unpushedCount });
  },

  sync: async () => {
    set({ isSyncing: true, error: null });
    const result = await window.profiles.sync();
    set({ isSyncing: false, error: result.ok ? null : (result.error ?? 'Something went wrong.') });
  }
}));
