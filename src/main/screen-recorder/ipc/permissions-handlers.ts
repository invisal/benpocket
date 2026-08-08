import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import {
  getMicrophoneStatus,
  getScreenRecordingStatus,
  openMicrophoneSettings,
  openScreenRecordingSettings
} from '../permissions/screen-recording-permission';

export function registerPermissionsHandlers(): void {
  ipcMain.handle(IpcChannels.GetScreenRecordingStatus, () => getScreenRecordingStatus());
  ipcMain.handle(IpcChannels.OpenScreenRecordingSettings, () => openScreenRecordingSettings());
  ipcMain.handle(IpcChannels.GetMicrophoneStatus, () => getMicrophoneStatus());
  ipcMain.handle(IpcChannels.OpenMicrophoneSettings, () => openMicrophoneSettings());
}
