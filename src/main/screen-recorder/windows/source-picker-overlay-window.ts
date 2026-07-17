import { app, BrowserWindow, ipcMain, screen, type Display } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  SourcePickerOverlayInit,
  SourcePickerOverlayOpenOptions
} from '@shared/source-picker-overlay';
import { preloadScriptPath } from '../lib/preload-path';
import { hideCaptureWindow, restoreCaptureWindow } from './window-visibility';

let overlayWindow: BrowserWindow | null = null;
// The focus-toolbar window that requested the overlay -- hidden while it's
// open (so the two aren't fighting for the topmost spot) and the one a pick
// gets relayed back to, since it owns the audio/webcam config a pick needs
// to actually start a recording.
let toolbarWindow: BrowserWindow | null = null;

/**
 * The display to open the overlay on -- wherever the cursor actually is
 * right now, since that's the one piece of state that reliably tells us
 * which monitor the user is currently looking at (they just clicked
 * Display/Window on the toolbar with the mouse). Previously this window
 * spanned every connected display at once, but macOS/Electron was only
 * actually rendering its content on one of them -- and not consistently the
 * one the user was on -- so a "click any monitor" overlay silently became
 * "the overlay only works on whichever monitor happens to win that render".
 */
function getCurrentDisplay(): Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function loadOverlayPage(win: BrowserWindow, init: SourcePickerOverlayInit): void {
  const query = JSON.stringify(init);

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/source-picker-overlay.html?options=${encodeURIComponent(query)}`
    );
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/source-picker-overlay.html'), {
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
    webPreferences: {
      preload: preloadScriptPath(),
      sandbox: false,
      contextIsolation: true
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  // Same reasoning as the focus toolbar itself -- this overlay must never
  // end up baked into the recording it's helping start.
  win.setContentProtection(true);
  win.on('closed', () => {
    if (overlayWindow === win) overlayWindow = null;
  });

  return win;
}

async function openSourcePickerOverlay(
  event: Electron.IpcMainInvokeEvent,
  options: SourcePickerOverlayOpenOptions
): Promise<void> {
  const toolbar = BrowserWindow.fromWebContents(event.sender);
  if (!toolbar) return;
  toolbarWindow = toolbar;

  await hideCaptureWindow(toolbar, { mainOnly: true });

  // Re-resolved on every open (not just at creation) -- the cursor, and so
  // the "current" display, can easily be on a different monitor from the
  // last time this overlay was shown, and the window is reused rather than
  // recreated.
  const display = getCurrentDisplay();
  if (!overlayWindow) {
    overlayWindow = createOverlayWindow(display);
  } else {
    overlayWindow.setBounds(display.bounds);
  }
  const win = overlayWindow;
  win.once('ready-to-show', () => win.show());

  loadOverlayPage(win, {
    ...options,
    origin: { x: display.bounds.x, y: display.bounds.y },
    targetDisplayId: String(display.id)
  });
}

/** Tears down the overlay and brings the toolbar back. */
function closeSourcePickerOverlay(): void {
  const toolbar = toolbarWindow;
  toolbarWindow = null;
  void restoreCaptureWindow(toolbar, { focus: true });

  const win = overlayWindow;
  overlayWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

export function registerSourcePickerOverlayHandlers(): void {
  ipcMain.handle(IpcChannels.SourcePickerOverlayOpen, openSourcePickerOverlay);

  ipcMain.on(IpcChannels.SourcePickerOverlayPick, (_event, sourceId: string) => {
    const toolbar = toolbarWindow;
    closeSourcePickerOverlay();
    toolbar?.webContents.send(IpcChannels.SourcePickerOverlayPicked, sourceId);
  });

  ipcMain.on(IpcChannels.SourcePickerOverlayCancel, () => {
    closeSourcePickerOverlay();
  });
}

/** Best-effort cleanup on app quit -- mirrors destroyTray()/destroyFocusToolbar(). */
export function destroySourcePickerOverlay(): void {
  const win = overlayWindow;
  overlayWindow = null;
  toolbarWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
}
