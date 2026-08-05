import { ipcRenderer } from 'electron';
import type { TelemetryEvent } from '@shared/telemetry-events';

export interface TelemetryApi {
  /** Fire-and-forget -- never awaited, never on a UI's critical path. */
  send: (event: TelemetryEvent) => void;
  getOptIn: () => Promise<boolean>;
  setOptIn: (optIn: boolean) => Promise<void>;
  getInstallId: () => Promise<string>;
  resetInstallId: () => Promise<string>;
  getLocalStats: () => Promise<Record<string, { count: number; lastUsedAt: number }>>;
}

export const telemetryApi: TelemetryApi = {
  send: (event) => ipcRenderer.send('telemetry:send', event),
  getOptIn: () => ipcRenderer.invoke('telemetry:get-opt-in'),
  setOptIn: (optIn) => ipcRenderer.invoke('telemetry:set-opt-in', optIn),
  getInstallId: () => ipcRenderer.invoke('telemetry:get-install-id'),
  resetInstallId: () => ipcRenderer.invoke('telemetry:reset-install-id'),
  getLocalStats: () => ipcRenderer.invoke('telemetry:get-local-stats')
};
