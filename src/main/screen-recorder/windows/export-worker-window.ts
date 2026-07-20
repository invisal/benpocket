import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';

let workerWindow: BrowserWindow | null = null;
// Resolves once `workerWindow`'s page has actually finished loading --
// created *before* `loadFile`/`loadURL` is called (see createWorkerWindow)
// so awaiting it is race-free regardless of exactly when Chromium flips
// `isLoading()`, unlike checking that flag after the fact.
let workerLoaded: Promise<void> | null = null;

function loadWorkerPage(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/export-worker.html`);
    return;
  }
  void win.loadFile(join(__dirname, '../renderer/export-worker.html'));
}

/**
 * The hidden export process (see the plan: `docs`/the session's approved
 * plan for why). Never shown, loads only our own bundled local HTML -- the
 * same trust level as the recorder-toolbar/region-select utility windows --
 * so `nodeIntegration: true` is safe here: it's what lets this window's own
 * page spawn/own the ffmpeg subprocesses and read/write their stdio streams
 * directly, keeping every per-frame byte inside this one process instead of
 * crossing the real main<->renderer IPC boundary.
 */
function createWorkerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 480,
    height: 270,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  // Otherwise-invisible: this window never shows a DevTools console, so
  // anything it logs (including uncaught errors in export-worker.ts) would
  // vanish silently without this -- surface it in the main process's own
  // stdout instead.
  win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[export-worker] ${sourceId}:${line} ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[export-worker] renderer process gone:', details);
  });
  // Dev-only: this window has no menu/right-click affordance to open
  // DevTools manually (it's never shown), and the `console-message` relay
  // above may not capture logs from the nested render Worker (a separate
  // JS global scope) -- a detached DevTools window is the only reliable way
  // to see everything happening in here, including Worker console output,
  // uncaught exceptions, and network/module-load failures.
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  workerLoaded = new Promise((resolve) => {
    win.webContents.once('did-finish-load', () => resolve());
  });
  loadWorkerPage(win);
  win.on('closed', () => {
    if (workerWindow === win) {
      workerWindow = null;
      workerLoaded = null;
    }
  });
  return win;
}

function getWorkerWindow(): { win: BrowserWindow; loaded: Promise<void> } {
  if (!workerWindow || workerWindow.isDestroyed()) {
    workerWindow = createWorkerWindow();
  }
  return { win: workerWindow, loaded: workerLoaded! };
}

type ExportWorkerResult = { ok: true } | { ok: false; error: string };

/** Forwards an export request to the hidden window and relays its progress/result back -- called from export-handlers.ts in place of the old in-process `exportManager.export()`. */
export async function runExportInWorkerWindow(
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void
): Promise<void> {
  const { win, loaded } = getWorkerWindow();
  await loaded;

  return new Promise((resolve, reject) => {
    const onProgressIpc = (event: Electron.IpcMainEvent, progress: ExportProgress): void => {
      if (event.sender !== win.webContents) return;
      onProgress(progress);
    };
    const onResult = (event: Electron.IpcMainEvent, result: ExportWorkerResult): void => {
      if (event.sender !== win.webContents) return;
      ipcMain.removeListener(IpcChannels.ExportProgress, onProgressIpc);
      ipcMain.removeListener(IpcChannels.ExportWorkerResult, onResult);
      if (result.ok) resolve();
      else reject(new Error(result.error));
    };
    ipcMain.on(IpcChannels.ExportProgress, onProgressIpc);
    ipcMain.on(IpcChannels.ExportWorkerResult, onResult);
    win.webContents.send(IpcChannels.ExportWorkerRun, options);
  });
}

/** Best-effort cleanup on app quit -- mirrors destroyRecorderToolbar(). */
export function destroyExportWorkerWindow(): void {
  const win = workerWindow;
  workerWindow = null;
  workerLoaded = null;
  if (win && !win.isDestroyed()) win.destroy();
}
