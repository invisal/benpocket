import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';

export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

let currentStatus: UpdaterStatus = { state: 'idle' };

function broadcastStatus(status: UpdaterStatus): void {
  currentStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:status-changed', status);
  }
}

export function registerUpdaterHandlers(): void {
  // Manual-only: checking never auto-downloads, and downloading never
  // auto-installs on quit -- both only ever happen in response to the
  // renderer's explicit updater:check / updater:update calls below.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => broadcastStatus({ state: 'checking' }));

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    broadcastStatus({ state: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => broadcastStatus({ state: 'not-available' }));

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    const version =
      currentStatus.state === 'available' || currentStatus.state === 'downloading'
        ? currentStatus.version
        : '';
    broadcastStatus({ state: 'downloading', percent: Math.round(progress.percent), version });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    // No further user confirmation by design -- the renderer's single
    // "Update" button already committed to download-then-install, so the
    // moment the download finishes we quit and install immediately. On
    // unsigned macOS builds this step can fail (signature verification),
    // which surfaces through the 'error' event below instead.
    broadcastStatus({ state: 'downloaded', version: info.version });
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err: Error) => {
    broadcastStatus({ state: 'error', message: errorMessage(err) });
  });

  ipcMain.handle('updater:check', async (): Promise<void> => {
    // autoUpdater throws when run unpackaged (no latest.yml to compare
    // against) -- keep dev/`npm run dev` sessions on a clean 'not-available'
    // status instead of surfacing that as a user-facing error.
    if (!app.isPackaged) {
      broadcastStatus({ state: 'not-available' });
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      broadcastStatus({ state: 'error', message: errorMessage(err) });
    }
  });

  ipcMain.handle('updater:update', async (): Promise<void> => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      broadcastStatus({ state: 'error', message: errorMessage(err) });
    }
  });

  ipcMain.handle('updater:get-status', (): UpdaterStatus => currentStatus);

  // Kick off the one-time startup check described in the app's update UX --
  // no polling/interval, just this single check per launch.
  if (app.isPackaged) {
    void autoUpdater.checkForUpdates().catch((err) => {
      broadcastStatus({ state: 'error', message: errorMessage(err) });
    });
  }
}
