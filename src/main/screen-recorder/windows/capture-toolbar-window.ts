import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { CaptureToolbarCapturePayload } from '@shared/capture-toolbar';
import type { ScreenRect } from '@shared/capture-region';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';
import { preloadScriptPath } from '../lib/preload-path';
import {
  hideCaptureWindow,
  isCursorOverWindow,
  minimizeCaptureWindow,
  restoreCaptureWindow,
  suppressWindowActivation
} from './window-visibility';
import { closeCaptureSourcePickerOverlay } from './capture-source-picker-overlay-window';

// Sized to the pill itself (grip, Cancel, Display/Window/Area).
// No popover headroom -- unlike the recorder toolbar -- so the window can
// sit on top without a click-through poll for empty chrome.
const TOOLBAR_WIDTH = 480;
const TOOLBAR_HEIGHT = 72;
const BOTTOM_MARGIN = 48;

let toolbarWindow: BrowserWindow | null = null;
let ownerWindow: BrowserWindow | null = null;

function loadToolbarPage(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/capture-toolbar.html`);
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/capture-toolbar.html'));
}

function computePosition(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  return {
    x: Math.round(display.workArea.x + (display.workArea.width - TOOLBAR_WIDTH) / 2),
    y: Math.round(display.workArea.y + display.workArea.height - TOOLBAR_HEIGHT - BOTTOM_MARGIN)
  };
}

function createToolbarWindow(): BrowserWindow {
  const { x, y } = computePosition();

  const win = new BrowserWindow({
    x,
    y,
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
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
  win.once('ready-to-show', () => win.showInactive());
  win.on('blur', () => {
    if (toolbarWindow !== win || !ownerWindow || ownerWindow.isDestroyed()) return;
    if (ownerWindow.isMinimized() || !ownerWindow.isVisible()) return;
    if (isCursorOverWindow(ownerWindow)) return;
    const release = suppressWindowActivation(ownerWindow);
    setImmediate(release);
  });
  win.on('closed', () => {
    if (toolbarWindow === win) toolbarWindow = null;
  });

  return win;
}

async function openCaptureToolbar(event: Electron.IpcMainInvokeEvent): Promise<void> {
  if (usesOsCapturePicker()) return;
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner) return;
  ownerWindow = owner;

  owner.webContents.setBackgroundThrottling(false);
  await minimizeCaptureWindow(owner);

  if (!toolbarWindow) toolbarWindow = createToolbarWindow();
  loadToolbarPage(toolbarWindow);
}

function closeCaptureToolbar(options?: { restoreOwner?: boolean }): void {
  if (ownerWindow && !ownerWindow.isDestroyed()) {
    ownerWindow.webContents.setBackgroundThrottling(true);
    ownerWindow.webContents.send(IpcChannels.CaptureToolbarClosed);
    if (options?.restoreOwner) {
      void restoreCaptureWindow(ownerWindow, { focus: true });
    }
  }

  const release = options?.restoreOwner ? () => {} : suppressWindowActivation(ownerWindow);
  closeCaptureSourcePickerOverlay({ restoreToolbar: false });

  const win = toolbarWindow;
  toolbarWindow = null;
  if (win && !win.isDestroyed()) win.close();
  setImmediate(release);
}

export function isCaptureToolbarSessionActive(): boolean {
  return Boolean(toolbarWindow && !toolbarWindow.isDestroyed());
}

export function getCaptureToolbarOwner(): BrowserWindow | null {
  return ownerWindow && !ownerWindow.isDestroyed() ? ownerWindow : null;
}

export function registerCaptureToolbarHandlers(): void {
  ipcMain.handle(IpcChannels.CaptureToolbarOpen, openCaptureToolbar);

  ipcMain.handle(IpcChannels.CaptureToolbarGetCurrentDisplayBounds, (): ScreenRect | null => {
    if (!toolbarWindow || toolbarWindow.isDestroyed()) return null;
    return screen.getDisplayMatching(toolbarWindow.getBounds()).bounds;
  });

  ipcMain.on(IpcChannels.CaptureToolbarCancel, () => {
    closeCaptureToolbar({ restoreOwner: true });
  });

  ipcMain.on(IpcChannels.CaptureSourcePickerOverlayCancel, () => {
    const release = suppressWindowActivation(ownerWindow);
    closeCaptureSourcePickerOverlay();
    setImmediate(release);
  });

  // Overlay / Area pick -- close the overlay without restoring the pill so
  // neither chrome window is in the shot, then relay to the owner renderer
  // (captureFromSource hides `event.sender`, which must be the main window).
  ipcMain.on(IpcChannels.CaptureToolbarCapture, (_event, payload: CaptureToolbarCapturePayload) => {
    closeCaptureSourcePickerOverlay({ restoreToolbar: false });
    void (async () => {
      await hideCaptureWindow(toolbarWindow, { mainOnly: true });
      ownerWindow?.webContents.send(IpcChannels.CaptureToolbarCaptureRequested, payload);
    })();
  });

  ipcMain.on(IpcChannels.CaptureToolbarCaptured, () => {
    closeCaptureToolbar({ restoreOwner: true });
  });
}

export function destroyCaptureToolbar(): void {
  closeCaptureSourcePickerOverlay({ restoreToolbar: false });
  const win = toolbarWindow;
  toolbarWindow = null;
  ownerWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
}
