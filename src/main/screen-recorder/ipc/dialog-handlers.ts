import { app, BrowserWindow, dialog, ipcMain, type FileFilter } from 'electron';
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
import { normalizeCaptureDelay, runCaptureCountdown } from '@shared/capture-delay';
import type { ScreenRect } from '@shared/capture-region';
import { getLastScreenshotSaveDir, setLastScreenshotSaveDir } from '../store/screen-capture-store';
import { getLastExportSaveDir, setLastExportSaveDir } from '../store/export-save-store';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';

const SAVE_FILTERS: Record<string, FileFilter> = {
  png: { name: 'PNG Image', extensions: ['png'] },
  jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
  jpeg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
  webp: { name: 'WebP Image', extensions: ['webp'] },
  avif: { name: 'AVIF Image', extensions: ['avif'] }
};

/** In-flight portal delay countdown, so Cancel from the renderer can abort it. */
let portalCountdownAbort: AbortController | null = null;

export function registerDialogHandlers(): void {
  ipcMain.handle(
    IpcChannels.ShowSaveExportDialog,
    async (event, defaultFileName: string, format: ExportFormat): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const lastSaveDir = getLastExportSaveDir();
      const defaultDir = lastSaveDir ?? join(app.getPath('videos'), 'ScreenRecorder');
      const options = {
        defaultPath: join(defaultDir, defaultFileName),
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
      };
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (canceled || !filePath) return null;
      setLastExportSaveDir(dirname(filePath));
      return filePath;
    }
  );

  ipcMain.handle(IpcChannels.ShowOpenVideoDialog, async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] }]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

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
    async (
      event,
      options?: { hideApp?: boolean; delaySeconds?: number }
    ): Promise<Buffer | null> => {
      // Screen Capture tool, Linux Wayland only — xdg-desktop-portal Screenshot.
      const hideApp = options?.hideApp ?? true;
      const win = BrowserWindow.fromWebContents(event.sender);

      // The delay countdown ticks here rather than in the renderer. Parking the
      // window on another workspace stops the compositor's frame callbacks and
      // Chromium freezes the page outright, which stalled the renderer's own
      // timer -- the count stuck mid-way and the grab never fired. A Node timer
      // in main keeps running no matter what the compositor does to the window.
      const delaySeconds = normalizeCaptureDelay(options?.delaySeconds);
      if (delaySeconds > 0) {
        portalCountdownAbort?.abort();
        const controller = new AbortController();
        portalCountdownAbort = controller;
        const sendTick = (remaining: number | null): void => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcChannels.CaptureScreenshotPortalTick, remaining);
          }
        };
        try {
          const completed = await runCaptureCountdown(delaySeconds, sendTick, {
            signal: controller.signal
          });
          if (!completed) return null;
        } finally {
          if (portalCountdownAbort === controller) portalCountdownAbort = null;
          sendTick(null);
        }
      }

      // Hide (unless the user opted to keep the app visible): GNOME freezes a
      // backdrop the moment the picker opens, so we need the compositor to
      // finish removing our window before that call. 350ms is longer than the
      // usual 100ms PipeWire settle — portal backdrop capture is less
      // forgiving of a late hide.
      if (hideApp) await hideCaptureWindow(win, { settleMs: 350 });
      try {
        return await captureViaPortal();
      } finally {
        if (hideApp) await restoreCaptureWindow(win, { focus: true });
      }
    }
  );

  ipcMain.on(IpcChannels.CaptureScreenshotPortalCancel, () => {
    portalCountdownAbort?.abort();
    portalCountdownAbort = null;
  });

  ipcMain.handle(
    IpcChannels.SaveScreenshot,
    async (event, data: ArrayBuffer, defaultFileName: string): Promise<string | null> => {
      // Screen Capture tool only.
      const win = BrowserWindow.fromWebContents(event.sender);
      const lastSaveDir = getLastScreenshotSaveDir();
      const defaultDir = lastSaveDir ?? app.getPath('pictures');
      const ext = defaultFileName.split('.').pop()?.toLowerCase() ?? 'png';
      const filter =
        SAVE_FILTERS[ext] ??
        ({ name: `${ext.toUpperCase()} Image`, extensions: [ext] } satisfies FileFilter);
      const options = {
        defaultPath: join(defaultDir, defaultFileName),
        filters: [filter]
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
