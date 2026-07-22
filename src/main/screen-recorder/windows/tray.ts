import {
  app,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron';
import { IpcChannels } from '@shared/ipc-channels';

/**
 * Tray icon quick-access for the screen recorder: clicking it pops up a
 * native menu with a single "Record Screen" entry that focuses the app and
 * opens the floating recorder toolbar, ready to start recording.
 *
 * Only lives while the Screen Recorder tool tab is open -- the renderer
 * (TrayBridge) tells us via IPC when to create/destroy it, rather than the
 * tray existing for the app's whole lifetime regardless of what's in use.
 * Kept as module state (not the returned value of a function) because
 * Electron destroys the OS-level tray icon if the `Tray` instance is
 * garbage collected.
 */
let trayInstance: Tray | null = null;

function createRecorderTray(iconPath: string, mainWindow: BrowserWindow): Tray {
  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  // Monochrome glyph -- let macOS render it as a template image (black/white,
  // following the menu bar's own light/dark appearance) instead of the flat
  // black it'd otherwise paint from the PNG's RGB data.
  image.setTemplateImage(true);
  const tray = new Tray(image);
  tray.setToolTip('benpocket -- click to record');

  tray.on('click', () => {
    showRecordMenu(tray, mainWindow);
  });

  return tray;
}

/** Wires up the renderer-facing register/unregister IPC for the recorder tray. */
export function registerTrayHandlers(iconPath: string): void {
  ipcMain.handle(IpcChannels.TrayRegister, (event) => {
    if (trayInstance) return;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    trayInstance = createRecorderTray(iconPath, win);
  });

  ipcMain.handle(IpcChannels.TrayUnregister, () => {
    trayInstance?.destroy();
    trayInstance = null;
  });
}

/** Tears down the tray icon, if any. Call on app quit. */
export function destroyTray(): void {
  trayInstance?.destroy();
  trayInstance = null;
}

/**
 * Deliberately doesn't show/focus `mainWindow` first -- the renderer
 * processes IPC and runs JS whether or not the window is on screen, and
 * opening the recorder toolbar (see recorder-toolbar-window.ts) minimizes
 * the owner window anyway. Showing it here first just produced a visible
 * flash of the main window an instant before it got minimized again.
 */
function sendToMainWindow(mainWindow: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, ...args);
}

function showRecordMenu(tray: Tray, mainWindow: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'New Screen Recording',
      click: () => sendToMainWindow(mainWindow, IpcChannels.TrayOpenRecordPicker)
    },
    { type: 'separator' },
    { label: 'Quit benpocket', click: () => app.quit() }
  ];

  tray.popUpContextMenu(Menu.buildFromTemplate(template));
}
