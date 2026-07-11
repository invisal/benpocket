import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportFormat } from '@screen-recorder/types/export';
import { copyScreenshotToClipboard } from '../clipboard/copy-screenshot-to-clipboard';
import {
  captureScreenPngWithHide,
  type ScreenshotCaptureRequest
} from '../capture/screenshot-capture';

export function registerDialogHandlers(): void {
  ipcMain.handle(
    IpcChannels.ShowSaveExportDialog,
    async (event, defaultFileName: string, format: ExportFormat): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options = {
        defaultPath: join(app.getPath('videos'), 'ScreenRecorder', defaultFileName),
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
      };
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return canceled || !filePath ? null : filePath;
    }
  );

  ipcMain.handle(IpcChannels.CopyScreenshot, async (event, data: ArrayBuffer): Promise<void> => {
    await copyScreenshotToClipboard(event.sender, data);
  });

  ipcMain.handle(
    IpcChannels.CaptureScreenshot,
    async (event, request: ScreenshotCaptureRequest): Promise<Buffer> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return captureScreenPngWithHide(win, request);
    }
  );

  ipcMain.handle(
    IpcChannels.SaveScreenshot,
    async (event, data: ArrayBuffer, defaultFileName: string): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options = {
        defaultPath: join(app.getPath('pictures'), defaultFileName),
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      };
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (canceled || !filePath) return null;
      await fs.writeFile(filePath, Buffer.from(data));
      return filePath;
    }
  );
}
