import { create } from 'zustand';

interface TelemetryState {
  /** Opt-out, not opt-in -- defaults true until the initial fetch resolves, same as
   * main's persisted default (see telemetry-store.ts). */
  optIn: boolean;
  refresh: () => Promise<void>;
  setOptIn: (optIn: boolean) => Promise<void>;
}

// Renderer-side cache of the opt-in flag -- backs the status bar's telemetry toggle
// (src/renderer/src/components/layout/TelemetryStatus.tsx).
export const useTelemetryStore = create<TelemetryState>()((set) => ({
  optIn: true,

  refresh: async () => {
    const optIn = await window.telemetry.getOptIn();
    set({ optIn });
  },

  setOptIn: async (optIn: boolean) => {
    await window.telemetry.setOptIn(optIn);
    set({ optIn });
  }
}));
