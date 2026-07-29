import { ipcMain, BrowserWindow } from 'electron';
import { KubeWatchManager, type WatchOptions } from '../services/KubeWatchManager';

export function registerWatchHandler(): void {
  ipcMain.handle('kuberneter:start-watch', (event, id: string, options: WatchOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    KubeWatchManager.startWatch(id, options, window);
    return { success: true };
  });

  ipcMain.handle('kuberneter:stop-watch', (_event, id: string) => {
    KubeWatchManager.stopWatch(id);
    return { success: true };
  });
}
