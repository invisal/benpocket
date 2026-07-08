import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { settingsStore, type AppSettings } from '../store/settings-store';

export function registerSettingsHandlers(): void {
  ipcMain.handle(IpcChannels.GetSettings, () => settingsStore.store);
  ipcMain.handle(IpcChannels.SetSettings, (_event, patch: Partial<AppSettings>) => {
    settingsStore.set({ ...settingsStore.store, ...patch });
    return settingsStore.store;
  });
}
