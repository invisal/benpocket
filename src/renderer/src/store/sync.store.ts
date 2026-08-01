import { create } from 'zustand';

interface RemoteStatus {
  hasChanges: boolean;
  latestSeq: number;
  count: number; // how many patches the remote is ahead by
}

interface SyncState {
  unpushedCount: number;
  isSyncing: boolean;
  error: string | null;
  remoteStatus: RemoteStatus | null;
  isCheckingStatus: boolean;
  statusError: string | null;
  isCompacting: boolean;
  compactError: string | null;
  /** Re-reads the active profile's unpushed patch count from main -- only needed for the initial value on mount; live updates arrive via SyncStatus's onUnpushedCountChanged subscription. */
  refresh: () => Promise<void>;
  /** Cheap remote precheck, no push/pull -- called when the status bar popover opens. */
  checkStatus: () => Promise<void>;
  /** Pushes/pulls through the active profile's SyncProvider. The resulting count arrives via that same push subscription, not a manual refetch. */
  sync: () => Promise<void>;
  /** Merges and compacts the active profile's remote patch log doc-by-doc. Runs a sync() on the main side first as a safety net. */
  compact: () => Promise<void>;
}

// Renderer-side cache of the active profile's unpushed-patch count (see
// src/main/store/profileManager.ts's getUnpushedPatchCount/sync) -- backs the
// status bar's sync indicator (src/renderer/src/components/layout/SyncStatus.tsx).
export const useSyncStore = create<SyncState>()((set) => ({
  unpushedCount: 0,
  isSyncing: false,
  error: null,
  remoteStatus: null,
  isCheckingStatus: false,
  statusError: null,
  isCompacting: false,
  compactError: null,

  refresh: async () => {
    const unpushedCount = await window.profiles.getUnpushedCount();
    set({ unpushedCount });
  },

  checkStatus: async () => {
    set({ isCheckingStatus: true, statusError: null });
    const result = await window.profiles.checkStatus();
    set(
      result.ok
        ? {
            isCheckingStatus: false,
            remoteStatus: {
              hasChanges: result.hasChanges,
              latestSeq: result.latestSeq,
              count: result.count
            }
          }
        : { isCheckingStatus: false, statusError: result.error ?? 'Something went wrong.' }
    );
  },

  sync: async () => {
    set({ isSyncing: true, error: null });
    const result = await window.profiles.sync();
    set({ isSyncing: false, error: result.ok ? null : (result.error ?? 'Something went wrong.') });
    // The cursor just moved (or a real error happened either way) -- refresh
    // the remote-status display rather than leaving the pre-sync "N changes
    // available" stale in the popover.
    await useSyncStore.getState().checkStatus();
  },

  compact: async () => {
    set({ isCompacting: true, compactError: null });
    const result = await window.profiles.compact();
    set({
      isCompacting: false,
      compactError: result.ok ? null : (result.error ?? 'Something went wrong.')
    });
    await useSyncStore.getState().checkStatus();
  }
}));
