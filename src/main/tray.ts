import {
  app,
  Tray,
  Menu,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';

export interface TrayIcons {
  /** macOS menu-bar template glyph (`*Template.png`). */
  trayTemplate: string;
  /** Full-color app icon for Linux/Windows status area. */
  appIcon: string;
}

/**
 * App-lifetime tray with a single menu: New Recording, Screen Capture, Quit.
 * On Linux, StatusNotifierItem does not emit `right-click` and
 * `popUpContextMenu` is a no-op — menus only work via `setContextMenu`.
 * Kept as module state because Electron destroys the OS tray icon if the
 * `Tray` instance is garbage collected.
 */
let trayInstance: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) return mainWindowRef;
  return null;
}

export function setTrayMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
}

function showMainWindow(): void {
  const win = getMainWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function sendToMainWindow(channel: string, ...args: unknown[]): void {
  const win = getMainWindow();
  if (!win) return;
  win.webContents.send(channel, ...args);
}

function trayMenuTemplate(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'New Recording',
      // Deliberately doesn't show/focus the main window first -- opening the
      // recorder toolbar minimizes the owner window anyway; showing first
      // just flashed the main window before it got minimized.
      click: () => sendToMainWindow(IpcChannels.TrayOpenRecordPicker)
    },
    {
      label: 'Screen Capture',
      click: () => {
        // Wayland: don't flash the window — Capture auto-starts the portal
        // picker and hideApp will restore focus when done.
        if (!usesOsCapturePicker()) showMainWindow();
        sendToMainWindow(IpcChannels.TrayOpenTool, 'screen-capture');
      }
    },
    { type: 'separator' },
    { label: 'Quit benpocket', click: () => app.quit() }
  ];
}

function createTrayImage(icons: TrayIcons): Electron.NativeImage {
  if (process.platform === 'darwin') {
    const image = nativeImage.createFromPath(icons.trayTemplate).resize({ width: 16, height: 16 });
    // Monochrome glyph -- let macOS render it as a template image.
    image.setTemplateImage(true);
    return image;
  }

  // Linux/Windows: full-color app icon. Template PNGs look blank/wrong under
  // StatusNotifierItem on Wayland, and 16px from a 512 source can be muddy —
  // 32px is the usual panel size.
  return nativeImage.createFromPath(icons.appIcon).resize({ width: 32, height: 32 });
}

/** Creates the persistent tray icon. No-op if one already exists. */
export function createAppTray(icons: TrayIcons, mainWindow: BrowserWindow): void {
  setTrayMainWindow(mainWindow);
  if (trayInstance) return;

  const tray = new Tray(createTrayImage(icons));
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
