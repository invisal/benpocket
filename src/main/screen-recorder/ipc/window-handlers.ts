import { BrowserWindow, ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';

function windowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

// Powers the custom, frameless titlebar in app/layout/TitleBar.tsx.
export function registerWindowHandlers(): void {
  ipcMain.handle(IpcChannels.WindowMinimize, (event) => {
    windowFromEvent(event)?.minimize();
  });

  ipcMain.handle(IpcChannels.WindowHide, async (event, options?: { mainOnly?: boolean }) => {
    // Screen Capture only — hide before screenshot / region overlay. TitleBar does not call this.
    await hideCaptureWindow(windowFromEvent(event), options);
  });

  ipcMain.handle(IpcChannels.WindowRestore, async (event, options?: { focus?: boolean }) => {
    // Screen Capture only — restore after screenshot / region overlay.
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

  ipcMain.handle(IpcChannels.WindowSetBackgroundThrottling, (event, allowed: boolean) => {
    windowFromEvent(event)?.webContents.setBackgroundThrottling(allowed);
  });

  // Lets a transparent, always-on-top window (currently just the recorder
  // toolbar -- see RecorderToolbarApp.tsx) click through its own empty/
  // transparent regions to whatever's underneath instead of blocking them,
  // while still being clickable over its actual visible content via
  // per-element onMouseEnter/onMouseLeave toggling this. `forward: true`
  // keeps mouse events (incl. enter/leave) reaching the renderer even while
  // ignoring, which is what makes that toggling possible in the first place.
  ipcMain.handle(
    IpcChannels.WindowSetIgnoreMouseEvents,
    (event, ignore: boolean, options?: { forward?: boolean }) => {
      windowFromEvent(event)?.setIgnoreMouseEvents(ignore, options);
    }
  );
}
