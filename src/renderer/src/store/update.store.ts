import { create } from 'zustand';

export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

interface UpdateState {
  status: UpdaterStatus;
  /** Re-reads the current status from main -- only needed for the initial value on mount; live updates arrive via UpdateStatus's onStatusChanged subscription. */
  refresh: () => Promise<void>;
  /** Manual re-check against GitHub Releases. Resulting status arrives via the push subscription, not this call's return value. */
  check: () => Promise<void>;
  /** Downloads the available update and installs it as soon as the download finishes -- single-button flow, no separate restart confirmation. */
  update: () => Promise<void>;
}

// Renderer-side cache of the update-checker's status (see
// src/main/updater/ipc.ts) -- backs the status bar's update indicator
// (src/renderer/src/components/layout/UpdateStatus.tsx).
export const useUpdateStore = create<UpdateState>()((set) => ({
  status: { state: 'idle' },

  refresh: async () => {
    const status = await window.updater.getStatus();
    set({ status });
  },

  check: async () => {
    await window.updater.check();
  },

  update: async () => {
    await window.updater.update();
  }
}));
