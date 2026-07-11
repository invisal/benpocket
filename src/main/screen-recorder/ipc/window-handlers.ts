import { app, BrowserWindow, ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

async function waitForWindowHidden(win: BrowserWindow): Promise<void> {
  if (!win.isVisible()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('hide', done);
      resolve();
    };
    win.on('hide', done);
    if (!win.isVisible()) done();
  });
}

async function waitForWindowShown(win: BrowserWindow): Promise<void> {
  if (win.isVisible()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('show', done);
      resolve();
    };
    win.on('show', done);
    if (win.isVisible()) done();
  });
}

// Powers the custom, frameless titlebar in app/layout/TitleBar.tsx -- see
// main-window.ts for why the window has no native frame/traffic lights.
export function registerWindowHandlers(): void {
  ipcMain.handle(IpcChannels.WindowMinimize, (event) => {
    windowFromEvent(event)?.minimize();
  });

  ipcMain.handle(IpcChannels.WindowHide, async (event) => {
    const win = windowFromEvent(event);
    if (!win) return;

    if (process.platform === 'darwin') {
      if (!app.isHidden()) app.hide();
      return;
    }

    if (!win.isVisible()) return;
    const hidden = waitForWindowHidden(win);
    win.hide();
    await hidden;
  });

  ipcMain.handle(IpcChannels.WindowRestore, async (event) => {
    const win = windowFromEvent(event);
    if (!win) return;

    if (process.platform === 'darwin') {
      app.show();
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
      return;
    }

    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) {
      const shown = waitForWindowShown(win);
      win.show();
      await shown;
    }

    // GNOME/Wayland blocks background apps from stealing focus and shows an
    // "app is ready" notification instead — briefly pin on top so show() lands.
    if (process.platform === 'linux') {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.focus();
      win.setAlwaysOnTop(false);
      return;
    }

    win.focus();
  });

  ipcMain.handle(IpcChannels.WindowToggleMaximize, (event) => {
    const win = windowFromEvent(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.handle(IpcChannels.WindowClose, (event) => {
    windowFromEvent(event)?.close();
  });

  ipcMain.handle(IpcChannels.WindowIsMaximized, (event) => {
    return windowFromEvent(event)?.isMaximized() ?? false;
  });
}

/** Wire a window's maximize/unmaximize events to push state to its renderer. */
export function forwardMaximizeState(win: BrowserWindow): void {
  win.on('maximize', () => win.webContents.send(IpcChannels.WindowMaximizeChanged, true));
  win.on('unmaximize', () => win.webContents.send(IpcChannels.WindowMaximizeChanged, false));
}
