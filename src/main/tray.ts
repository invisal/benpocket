import {
  app,
  Tray,
  Menu,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { showAppLauncherIcon } from './screen-recorder/windows/window-visibility';

/**
 * App-lifetime tray menu: Open, New Recording, Screen Capture, Quit.
 * On Linux, StatusNotifierItem does not emit `right-click` and
 * `popUpContextMenu` is a no-op — menus only work via `setContextMenu`.
 * Kept as module state because Electron destroys the OS tray icon if the
 * `Tray` instance is garbage collected.
 */
let trayInstance: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) return mainWindowRef;
  return null;
}

export function setTrayMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
}

function showMainWindow(): void {
  const win = getMainWindow();
  if (!win) return;
  showAppLauncherIcon(win);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function sendToMainWindow(channel: string, ...args: unknown[]): void {
  const win = getMainWindow();
  if (!win) return;
  win.webContents.send(channel, ...args);
}

function trayMenuTemplate(): MenuItemConstructorOptions[] {
  return [
    { label: 'Open benpocket', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'New Recording',
      // Deliberately doesn't show/focus the main window first -- opening the
      // recorder toolbar minimizes the owner window anyway; showing first
      // just flashed the main window before it got minimized.
      click: () => sendToMainWindow(IpcChannels.TrayOpenRecordPicker),
      accelerator: process.platform === 'darwin' ? 'CommandOrControl+Shift+R' : 'Control+Shift+R'
    },
    {
      label: 'Screen Capture',
      // Never shows the main window first: on pill platforms
      // openCaptureToolbarFor minimizes the owner the same way New Recording
      // does, and on Wayland the renderer goes straight to the OS portal. The
      // window only comes up afterwards, to show the captured image.
      click: () => sendToMainWindow(IpcChannels.TrayOpenTool, 'screen-capture')
    },
    { type: 'separator' },
    { label: 'Quit benpocket', click: () => app.quit() }
  ];
}

function createTrayImage(appIcon: string): Electron.NativeImage {
  // Full-color app icon everywhere. macOS menu bar is ~22px tall; Linux/Windows
  // panels are usually bigger and 16px from a 512+ source can look muddy there,
  // so 32px is used as the usual panel size.
  const size = process.platform === 'darwin' ? 22 : 32;
  return nativeImage.createFromPath(appIcon).resize({ width: size, height: size });
}

/** Creates the persistent tray icon. No-op if one already exists. */
export function createAppTray(appIcon: string, mainWindow: BrowserWindow): void {
  setTrayMainWindow(mainWindow);
  if (trayInstance) return;

  const tray = new Tray(createTrayImage(appIcon));
  tray.setToolTip('benpocket');

  if (process.platform === 'linux') {
    // Electron: `right-click` and `popUpContextMenu` are macOS/Windows-only.
    // Linux trays only show a menu registered with setContextMenu.
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate()));
  } else {
    tray.on('click', () => {
      tray.popUpContextMenu(Menu.buildFromTemplate(trayMenuTemplate()));
    });
    tray.on('right-click', () => {
      tray.popUpContextMenu(Menu.buildFromTemplate(trayMenuTemplate()));
    });
  }

  trayInstance = tray;
}

/** Tears down the tray icon, if any. Call on app quit. */
export function destroyTray(): void {
  trayInstance?.destroy();
  trayInstance = null;
}
