import { ipcMain } from 'electron';
import type { TelemetryEvent } from '@shared/telemetry-events';
import { telemetryStore } from './telemetry-store';

export function registerTelemetryHandlers(): void {
  // Fire-and-forget -- matches docs/telemetry.md's "send is ipcRenderer.send, not
  // invoke", so a call site never awaits (or blocks on) its own telemetry.
  ipcMain.on('telemetry:send', (_event, payload: TelemetryEvent) => {
    telemetryStore.enqueue(payload);
  });

  ipcMain.handle('telemetry:get-opt-in', (): boolean => telemetryStore.getOptIn());
  ipcMain.handle('telemetry:set-opt-in', (_event, optIn: boolean): void =>
    telemetryStore.setOptIn(optIn)
  );
  ipcMain.handle('telemetry:get-install-id', (): string => telemetryStore.getOrCreateInstallId());
  ipcMain.handle('telemetry:reset-install-id', (): string => telemetryStore.resetInstallId());
  ipcMain.handle('telemetry:get-local-stats', () => telemetryStore.getLocalStats());
}
