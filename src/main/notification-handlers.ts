import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { showNativeNotification } from './notifications/show-notification';

export function registerNotificationHandlers(): void {
  ipcMain.handle(IpcChannels.ShowNotification, (_event, title: string, body: string): boolean =>
    showNativeNotification(title, body)
  );
}
