import { BrowserWindow, ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

// Powers the custom, frameless titlebar in app/layout/TitleBar.tsx -- see
// main-window.ts for why the window has no native frame/traffic lights.
export function registerWindowHandlers(): void {
  ipcMain.handle(IpcChannels.WindowMinimize, (event) => {
    windowFromEvent(event)?.minimize();
  });

  ipcMain.handle(IpcChannels.WindowHide, async (event, options?: { mainOnly?: boolean }) => {
    await hideCaptureWindow(windowFromEvent(event), options);
  });

  ipcMain.handle(IpcChannels.WindowRestore, async (event, options?: { focus?: boolean }) => {
    await restoreCaptureWindow(windowFromEvent(event), options);
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
