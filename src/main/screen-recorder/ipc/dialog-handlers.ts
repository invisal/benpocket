import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportFormat } from '@screen-recorder/types/export';
import { copyScreenshotToClipboard } from '../clipboard/copy-screenshot-to-clipboard';
import {
  captureRegionPngDarwin,
  captureScreenPngWithHide,
  type ScreenshotCaptureRequest
} from '../capture/screenshot-capture';
import { captureViaPortal } from '../capture/portal-screenshot';
import type { ScreenRect } from '@shared/capture-region';
import { getLastScreenshotSaveDir, setLastScreenshotSaveDir } from '../store/screen-capture-store';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';

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

  ipcMain.handle(IpcChannels.CaptureRegion, async (_event, rect: ScreenRect): Promise<Buffer> => {
    // Screen Capture tool, macOS only — native rectangle grab after the live overlay drag.
    return captureRegionPngDarwin(rect);
  });

  ipcMain.handle(
    IpcChannels.CaptureScreenshotPortal,
    async (event, options?: { hideApp?: boolean }): Promise<Buffer | null> => {
      // Screen Capture tool, Linux Wayland only — xdg-desktop-portal Screenshot.
      // Hide first (unless the user opted to keep the app visible): GNOME
      // freezes a backdrop the moment the picker opens, so we need the
      // compositor to finish removing our window before that call. 350ms is
      // longer than the usual 100ms PipeWire settle — portal backdrop capture
      // is less forgiving of a late hide.
      const hideApp = options?.hideApp ?? true;
      const win = BrowserWindow.fromWebContents(event.sender);
      if (hideApp) await hideCaptureWindow(win, { settleMs: 350 });
      try {
        return await captureViaPortal();
      } finally {
        if (hideApp) await restoreCaptureWindow(win, { focus: true });
      }
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
