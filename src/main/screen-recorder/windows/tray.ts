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
import type { CaptureSource } from '@screen-recorder/types/recording';
import { listCaptureSources } from '../capture/screen-source-provider';

/**
 * Tray icon quick-access for the screen recorder: clicking it pops up a
 * native menu of currently available screens/windows (thumbnails included,
 * refetched fresh on every click so it's never stale) -- picking one
 * focuses the app and pre-selects that source on the record-setup page,
 * ready for one more click to actually start. Mirrors the "click tray, pick
 * a source, hit record" flow common to screen-recording apps (Loom,
 * CleanShot, etc), just via a real OS menu instead of jumping straight into
 * the app window.
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
  const tray = new Tray(image);
  tray.setToolTip('CraftBox -- click to record');

  tray.on('click', () => {
    void showRecordMenu(tray, mainWindow);
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

function focusAndSend(mainWindow: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send(channel, ...args);
}

function sourceMenuItem(
  source: CaptureSource,
  mainWindow: BrowserWindow
): MenuItemConstructorOptions {
  return {
    label: source.name,
    icon: source.thumbnailDataUrl
      ? nativeImage.createFromDataURL(source.thumbnailDataUrl).resize({ width: 16, height: 16 })
      : undefined,
    click: () => focusAndSend(mainWindow, IpcChannels.TraySourceSelected, source)
  };
}

async function showRecordMenu(tray: Tray, mainWindow: BrowserWindow): Promise<void> {
  const sources = await listCaptureSources();
  const screens = sources.filter((s) => s.type === 'screen');
  const windows = sources.filter((s) => s.type === 'window');

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Open Screen Recorder',
      click: () => focusAndSend(mainWindow, IpcChannels.TrayOpenRecordPicker)
    },
    { type: 'separator' }
  ];

  if (screens.length > 0) {
    template.push(
      { label: 'Screens', enabled: false },
      ...screens.map((source) => sourceMenuItem(source, mainWindow))
    );
  }
  if (windows.length > 0) {
    if (screens.length > 0) template.push({ type: 'separator' });
    template.push(
      { label: 'Windows', enabled: false },
      ...windows.map((source) => sourceMenuItem(source, mainWindow))
    );
  }
  if (screens.length === 0 && windows.length === 0) {
    template.push({ label: 'No sources available', enabled: false });
  }

  template.push({ type: 'separator' }, { label: 'Quit CraftBox', click: () => app.quit() });

  tray.popUpContextMenu(Menu.buildFromTemplate(template));
}
