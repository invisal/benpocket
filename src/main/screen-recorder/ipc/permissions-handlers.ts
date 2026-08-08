import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import {
  getAccessibilityStatus,
  getCameraStatus,
  getMicrophoneStatus,
  getScreenRecordingStatus,
  openAccessibilitySettings,
  openAutomationSettings,
  openCameraSettings,
  openMicrophoneSettings,
  openScreenRecordingSettings,
  relaunchApp,
  requestAccessibilityAccess,
  requestAutomationAccess,
  requestCameraAccess,
  requestMicrophoneAccess
} from '../permissions/permissions';

export function registerPermissionsHandlers(): void {
  ipcMain.handle(IpcChannels.GetScreenRecordingStatus, () => getScreenRecordingStatus());
  ipcMain.handle(IpcChannels.OpenScreenRecordingSettings, () => openScreenRecordingSettings());
  ipcMain.handle(IpcChannels.GetMicrophoneStatus, () => getMicrophoneStatus());
  ipcMain.handle(IpcChannels.OpenMicrophoneSettings, () => openMicrophoneSettings());
  ipcMain.handle(IpcChannels.RequestMicrophoneAccess, () => requestMicrophoneAccess());
  ipcMain.handle(IpcChannels.RelaunchApp, () => relaunchApp());
  ipcMain.handle(IpcChannels.GetCameraStatus, () => getCameraStatus());
  ipcMain.handle(IpcChannels.OpenCameraSettings, () => openCameraSettings());
  ipcMain.handle(IpcChannels.RequestCameraAccess, () => requestCameraAccess());
  ipcMain.handle(IpcChannels.GetAccessibilityStatus, () => getAccessibilityStatus());
  ipcMain.handle(IpcChannels.RequestAccessibilityAccess, () => requestAccessibilityAccess());
  ipcMain.handle(IpcChannels.OpenAccessibilitySettings, () => openAccessibilitySettings());
  ipcMain.handle(IpcChannels.RequestAutomationAccess, () => requestAutomationAccess());
  ipcMain.handle(IpcChannels.OpenAutomationSettings, () => openAutomationSettings());
}
