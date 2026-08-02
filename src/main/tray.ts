import {
  app,
  Tray,
  Menu,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron';
import { is } from '@electron-toolkit/utils';
import { IpcChannels } from '@shared/ipc-channels';

export type TrayToolName =
  | 'file-explorer'
  | 'http-client'
  | 'kuberneter'
  | 'screen-recorder'
  | 'screen-capture'
  | 'storybook';

export interface TrayIcons {
  /** macOS menu-bar template glyph (`*Template.png`). */
  trayTemplate: string;
  /** Full-color app icon for Linux/Windows status area. */
  appIcon: string;
}

/**
 * App-lifetime tray: on macOS/Windows, left-click = recorder menu and
 * right-click = tools menu. On Linux, StatusNotifierItem does not emit
 * `right-click` and `popUpContextMenu` is a no-op — menus only work via
 * `setContextMenu`, so Linux gets one combined native menu instead.
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

function openTool(tool: TrayToolName): void {
  showMainWindow();
  sendToMainWindow(IpcChannels.TrayOpenTool, tool);
}

function quitApp(): void {
  app.quit();
}

function recordMenuTemplate(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'New Recording',
      // Deliberately doesn't show/focus the main window first -- opening the
      // recorder toolbar minimizes the owner window anyway; showing first
      // just flashed the main window before it got minimized.
      click: () => sendToMainWindow(IpcChannels.TrayOpenRecordPicker)
    },
    { type: 'separator' },
    { label: 'Quit benpocket', click: quitApp }
  ];
}

function toolsMenuTemplate(): MenuItemConstructorOptions[] {
  const tools: MenuItemConstructorOptions[] = [
    { label: 'Show benpocket', click: showMainWindow },
    { type: 'separator' },
    { label: 'File Explorer', click: () => openTool('file-explorer') },
    { label: 'HTTP Client', click: () => openTool('http-client') },
    { label: 'Kuberneter', click: () => openTool('kuberneter') },
    { label: 'Screen Recorder', click: () => openTool('screen-recorder') },
    { label: 'Screen Capture', click: () => openTool('screen-capture') }
  ];

  if (is.dev) {
    tools.push({ label: 'Storybook', click: () => openTool('storybook') });
  }

  tools.push({ type: 'separator' }, { label: 'Quit benpocket', click: quitApp });
  return tools;
}

/** Single menu for Linux SNI/AppIndicator (left- and right-click both use it). */
function linuxMenuTemplate(): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [
    { label: 'Show benpocket', click: showMainWindow },
    {
      label: 'New Recording',
      click: () => sendToMainWindow(IpcChannels.TrayOpenRecordPicker)
    },
    { type: 'separator' },
    { label: 'File Explorer', click: () => openTool('file-explorer') },
    { label: 'HTTP Client', click: () => openTool('http-client') },
    { label: 'Kuberneter', click: () => openTool('kuberneter') },
    { label: 'Screen Recorder', click: () => openTool('screen-recorder') },
    { label: 'Screen Capture', click: () => openTool('screen-capture') }
  ];

  if (is.dev) {
    items.push({ label: 'Storybook', click: () => openTool('storybook') });
  }

  items.push({ type: 'separator' }, { label: 'Quit benpocket', click: quitApp });
  return items;
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
    tray.setContextMenu(Menu.buildFromTemplate(linuxMenuTemplate()));
    // Activation (often left-click / double-click depending on DE).
    tray.on('click', () => {
      showMainWindow();
    });
  } else {
    tray.on('click', () => {
      tray.popUpContextMenu(Menu.buildFromTemplate(recordMenuTemplate()));
    });
    tray.on('right-click', () => {
      tray.popUpContextMenu(Menu.buildFromTemplate(toolsMenuTemplate()));
    });
  }

  trayInstance = tray;
}

/** Tears down the tray icon, if any. Call on app quit. */
export function destroyTray(): void {
  trayInstance?.destroy();
  trayInstance = null;
}
