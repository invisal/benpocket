import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportFormat } from '@screen-recorder/types/export';
import { copyScreenshotToClipboard } from '../clipboard/copy-screenshot-to-clipboard';
import {
  captureScreenPngWithHide,
  type ScreenshotCaptureRequest
} from '../capture/screenshot-capture';
import { pickOsCaptureSource } from '../capture/pick-os-capture-source';
import type { OsPickerSource } from '@shared/os-picker-source';
import { getLastScreenshotSaveDir, setLastScreenshotSaveDir } from '../store/screen-capture-store';

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
    // Screen Capture tool only.
    await copyScreenshotToClipboard(event.sender, data);
  });

  ipcMain.handle(
    IpcChannels.CaptureScreenshot,
    async (event, request: ScreenshotCaptureRequest): Promise<Buffer> => {
      // Screen Capture tool only — atomic hide/grab/restore for full-display stills.
      const win = BrowserWindow.fromWebContents(event.sender);
      return captureScreenPngWithHide(win, request);
    }
  );

  ipcMain.handle(
    IpcChannels.PickOsCaptureSource,
    async (_event, options?: { monitorOnly?: boolean }): Promise<OsPickerSource | null> => {
      return pickOsCaptureSource(options?.monitorOnly ?? false);
    }
  );

  ipcMain.handle(
    IpcChannels.SaveScreenshot,
    async (event, data: ArrayBuffer, defaultFileName: string): Promise<string | null> => {
      // Screen Capture tool only.
      const win = BrowserWindow.fromWebContents(event.sender);
      const lastSaveDir = getLastScreenshotSaveDir();
      const defaultDir = lastSaveDir ?? app.getPath('pictures');
      const options = {
        defaultPath: join(defaultDir, defaultFileName),
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      };
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (canceled || !filePath) return null;
      await fs.writeFile(filePath, Buffer.from(data));
      setLastScreenshotSaveDir(dirname(filePath));
      return filePath;
    }
  );
}
