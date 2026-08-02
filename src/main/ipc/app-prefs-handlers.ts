import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { getAppPrefs, setAppPrefs, type AppPrefs } from '../store/app-prefs-store';

export function registerAppPrefsHandlers(): void {
  ipcMain.handle(IpcChannels.GetAppPrefs, () => getAppPrefs());
  ipcMain.handle(IpcChannels.SetAppPrefs, (_event, patch: Partial<AppPrefs>) => setAppPrefs(patch));
}
