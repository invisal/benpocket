import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import {
  getScreenRecordingStatus,
  openScreenRecordingSettings
} from '../permissions/screen-recording-permission';

export function registerPermissionsHandlers(): void {
  ipcMain.handle(IpcChannels.GetScreenRecordingStatus, () => getScreenRecordingStatus());
  ipcMain.handle(IpcChannels.OpenScreenRecordingSettings, () => openScreenRecordingSettings());
}
