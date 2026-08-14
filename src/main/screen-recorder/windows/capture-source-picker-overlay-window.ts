import { app, BrowserWindow, ipcMain, screen, type Display } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureSourcePickerOverlayInit,
  CaptureSourcePickerOverlayOpenOptions
} from '@shared/capture-source-picker-overlay';
import { preloadScriptPath } from '../lib/preload-path';
import { hideCaptureWindow } from './window-visibility';

let overlayWindow: BrowserWindow | null = null;
/** Capture-toolbar window that requested the overlay -- hidden while it's open. */
let toolbarWindow: BrowserWindow | null = null;

function getCurrentDisplay(): Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function loadOverlayPage(win: BrowserWindow, init: CaptureSourcePickerOverlayInit): void {
  const query = JSON.stringify(init);

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/capture-source-picker-overlay.html?options=${encodeURIComponent(query)}`
    );
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/capture-source-picker-overlay.html'), {
    query: { options: query }
  });
}

function createOverlayWindow(display: Display): BrowserWindow {
  const { bounds } = display;

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: preloadScriptPath(),
      sandbox: false,
      contextIsolation: true
    }
  });

  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(true);
  win.on('closed', () => {
    if (overlayWindow === win) overlayWindow = null;
  });

  return win;
}

async function openCaptureSourcePickerOverlay(
  event: Electron.IpcMainInvokeEvent,
  options: CaptureSourcePickerOverlayOpenOptions
): Promise<void> {
  const toolbar = BrowserWindow.fromWebContents(event.sender);
  if (!toolbar) return;
  toolbarWindow = toolbar;

  await hideCaptureWindow(toolbar, { mainOnly: true });

  const display = getCurrentDisplay();
  if (!overlayWindow) {
    overlayWindow = createOverlayWindow(display);
  } else {
    overlayWindow.setBounds(display.bounds);
  }
  const win = overlayWindow;
  win.once('ready-to-show', () => win.showInactive());

  loadOverlayPage(win, {
    ...options,
    origin: { x: display.bounds.x, y: display.bounds.y },
    targetDisplayId: String(display.id)
  });
}

/**
 * Tears down the overlay. Cancel restores the pill; a delay-0 pick leaves it
 * hidden so it isn't in the screenshot. A delayed pick restores it so the
 * pill can count down over the real desktop.
 */
export function closeCaptureSourcePickerOverlay(options?: { restoreToolbar?: boolean }): void {
  const toolbar = toolbarWindow;
  toolbarWindow = null;
  // Do not restoreCaptureWindow — that calls app.show() and brings the main
  // window forward. Re-show the pill without activating the app.
  if (options?.restoreToolbar !== false && toolbar && !toolbar.isDestroyed()) {
    toolbar.showInactive();
    toolbar.webContents.send(IpcChannels.CaptureSourcePickerOverlayClosed);
  }

  const win = overlayWindow;
  overlayWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

export function registerCaptureSourcePickerOverlayHandlers(): void {
  ipcMain.handle(IpcChannels.CaptureSourcePickerOverlayOpen, openCaptureSourcePickerOverlay);
}

export function destroyCaptureSourcePickerOverlay(): void {
  const win = overlayWindow;
  overlayWindow = null;
  toolbarWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
}
