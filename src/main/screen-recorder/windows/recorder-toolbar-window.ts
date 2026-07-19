import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  RecorderToolbarOpenPayload,
  RecorderToolbarStartPayload,
  RecorderToolbarRecordingResult
} from '@shared/recorder-toolbar';
import type { ScreenRect } from '@shared/capture-region';
import { preloadScriptPath } from '../lib/preload-path';
import { minimizeCaptureWindow, restoreCaptureWindow } from './window-visibility';

// Fixed rather than measured -- a window sized to fit whatever content is
// currently rendered turned out to be more fragile than it was worth (a
// resize round-trip on every mode/content change, racing with other
// window-management calls). Wide enough for the setup toolbar's full row
// (grip, close, Display/Window/Area, camera, mic, system audio, Start
// Recording) without a per-source filmstrip -- that's the one element here
// that scales with user data (could be a dozen windows) rather than a fixed
// label set, so it isn't rendered at all now rather than fought over width.
// Taller than the pill itself needs (it's bottom-anchored within this via
// `justify-end`, see RecorderToolbarApp.tsx) -- the Camera/Device popovers
// open upward from the pill and, since this window is transparent/fixed-size
// with nothing else to clip against, any room they need has to already
// exist inside these bounds or Base UI's collision handling just shrinks
// them into an unusably short scroll area instead of actually being cut off
// invisibly. The extra space above the pill stays fully transparent when no
// popover is open, so this is a no-op visually until one opens.
const TOOLBAR_WIDTH = 880;
const TOOLBAR_HEIGHT = 280;
// What TOOLBAR_HEIGHT was before popovers needed headroom above the pill --
// still the right anchor for the "tucked below the target" placement below,
// since the pill sits flush against the window's *bottom* edge either way.
// The bottom-center and "above" placements don't need this: both already
// derive their y from `-TOOLBAR_HEIGHT`, which cancels back out once you
// add TOOLBAR_HEIGHT to find the window's bottom edge, so growing the
// constant doesn't move their pill. "below" computes y (the window's *top*)
// directly instead, so without this offset the pill would drift down by the
// exact amount of headroom added.
const PILL_FOOTER_HEIGHT = 110;
const BOTTOM_MARGIN = 48;
const GAP_FROM_TARGET = 16;

let toolbarWindow: BrowserWindow | null = null;
// The window that opened the toolbar -- hidden for the duration and the one
// that receives the start/stop/cancel relays, since it owns the actual
// recording-controller/store state. Tracked separately from `toolbarWindow`
// because the "restore" side of a close needs it even after the toolbar
// itself has already been torn down.
let ownerWindow: BrowserWindow | null = null;
// Screen-space rect of what's actually being recorded, set the moment the
// toolbar's Start Recording is clicked (see RecorderToolbarStart below) and
// used to reposition the toolbar right then, so it reads as attached to
// that display/window/area instead of always sitting at the bottom of the
// primary display. Null before a start attempt, and cleared whenever the
// toolbar closes so a fresh session doesn't inherit it.
let lastTargetBounds: ScreenRect | null = null;

function loadToolbarPage(win: BrowserWindow, payload: RecorderToolbarOpenPayload): void {
  const init = JSON.stringify(payload);

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/recorder-toolbar.html?init=${encodeURIComponent(init)}`
    );
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/recorder-toolbar.html'), { query: { init } });
}

/**
 * Where the (fixed-size) window should sit. Anchored to `lastTargetBounds`
 * once known -- `screen.getDisplayMatching` finds the display it's
 * actually on, in case that's not the primary one. A rect that's basically
 * the whole display gets the usual bottom-center treatment; a smaller one
 * (a window with resolvable bounds, or an Area selection) gets the toolbar
 * tucked just below it instead -- or above, if there's no room below -- so
 * it reads as attached to the thing being recorded rather than floating
 * disconnected at the bottom of whichever screen happens to be primary.
 * Falls back to primary-display-bottom-center when nothing has started
 * recording yet.
 */
function computePosition(): { x: number; y: number } {
  if (!lastTargetBounds) {
    const display = screen.getPrimaryDisplay();
    return {
      x: Math.round(display.workArea.x + (display.workArea.width - TOOLBAR_WIDTH) / 2),
      y: Math.round(display.workArea.y + display.workArea.height - TOOLBAR_HEIGHT - BOTTOM_MARGIN)
    };
  }

  const target = lastTargetBounds;
  const display = screen.getDisplayMatching({
    x: Math.round(target.x),
    y: Math.round(target.y),
    width: Math.round(target.width),
    height: Math.round(target.height)
  });

  const isFullDisplay =
    target.width >= display.workArea.width - 4 && target.height >= display.workArea.height - 4;
  if (isFullDisplay) {
    return {
      x: Math.round(display.workArea.x + (display.workArea.width - TOOLBAR_WIDTH) / 2),
      y: Math.round(display.workArea.y + display.workArea.height - TOOLBAR_HEIGHT - BOTTOM_MARGIN)
    };
  }

  const centeredX = target.x + target.width / 2 - TOOLBAR_WIDTH / 2;
  const minX = display.workArea.x;
  const maxX = display.workArea.x + display.workArea.width - TOOLBAR_WIDTH;
  const x = Math.round(Math.min(Math.max(centeredX, minX), maxX));

  const belowY = target.y + target.height + GAP_FROM_TARGET - (TOOLBAR_HEIGHT - PILL_FOOTER_HEIGHT);
  const fitsBelow = belowY + TOOLBAR_HEIGHT <= display.workArea.y + display.workArea.height;
  const y = Math.round(
    fitsBelow ? belowY : Math.max(display.workArea.y, target.y - TOOLBAR_HEIGHT - GAP_FROM_TARGET)
  );

  return { x, y };
}

/** Re-centers the window on its current anchor (see computePosition) without touching its size. */
function repositionToolbar(): void {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) return;
  const { x, y } = computePosition();
  toolbarWindow.setPosition(x, y);
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
    // Draggable by its own background (see the `app-region: drag` styling
    // on the pill in RecorderToolbarApp.tsx) rather than fixed in place.
    movable: true,
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
  // Excludes this window from screen/window capture (including our own
  // desktopCapturer-based recording) so the toolbar never ends up baked
  // into the video it's controlling. Note: per Electron's docs, macOS apps
  // that capture via ScreenCaptureKit can still see the window despite this
  // -- Screen Recorder's own capture path (chromeMediaSourceId, not
  // getDisplayMedia) isn't one of those, so this covers the case that
  // actually matters here.
  win.setContentProtection(true);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (toolbarWindow === win) toolbarWindow = null;
  });

  return win;
}

async function openRecorderToolbar(
  event: Electron.IpcMainInvokeEvent,
  payload: RecorderToolbarOpenPayload
): Promise<void> {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner) return;
  ownerWindow = owner;

  // Area-crop recording relays frames through a canvas driven by
  // requestAnimationFrame in this (owner) window's renderer -- Chromium
  // throttles/suspends rAF once the window is hidden below, which starved
  // the canvas of frames and produced an unplayable recording. Disabling
  // background throttling keeps that loop running at full rate while hidden.
  owner.webContents.setBackgroundThrottling(false);

  // Minimized rather than hidden -- a full hide leaves no Dock icon/window
  // to click back to, so once the toolbar has your attention the owning
  // window effectively vanishes. Minimizing removes it from the screen just
  // as well (still absent from a 'Display' capture) while leaving a
  // clickable Dock thumbnail; `closeRecorderToolbar` below un-minimizes it
  // via `restoreCaptureWindow`.
  await minimizeCaptureWindow(owner);

  if (!toolbarWindow) toolbarWindow = createToolbarWindow();
  loadToolbarPage(toolbarWindow, payload);
}

/** Tears down the toolbar and brings the owning window back. */
function closeRecorderToolbar(): void {
  if (ownerWindow && !ownerWindow.isDestroyed()) {
    ownerWindow.webContents.setBackgroundThrottling(true);
    // Lets the owner's sidebar re-enable "Launch Recorder" -- see
    // ScreenRecorderSidebar.tsx. Re-invoking that while this toolbar was
    // still open used to reload it out from under an active recording
    // (loadToolbarPage resets its local `mode` state back to 'setup'),
    // leaving no way to reach Stop for a capture that was still running.
    ownerWindow.webContents.send(IpcChannels.RecorderToolbarClosed);
  }
  void restoreCaptureWindow(ownerWindow, { focus: true });
  lastTargetBounds = null;

  const win = toolbarWindow;
  toolbarWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

export function registerRecorderToolbarHandlers(): void {
  ipcMain.handle(IpcChannels.RecorderToolbarOpen, openRecorderToolbar);

  // User backed out (Esc / close button) before starting a recording.
  // closeRecorderToolbar() below also notifies the owner (RecorderToolbarClosed)
  // so its "toolbar is open" flag clears.
  ipcMain.on(IpcChannels.RecorderToolbarCancel, () => {
    closeRecorderToolbar();
  });

  // Toolbar -> owner: apply this config and start capturing. The owner
  // renderer keeps running while hidden (see capture-engine.ts /
  // useRecordingController), so it can still open getUserMedia + drive
  // MediaRecorder without ever being shown. Also latches the target bounds
  // and repositions right away, on the click itself, rather than waiting
  // for confirmation that the recording actually started.
  ipcMain.on(IpcChannels.RecorderToolbarStart, (_event, payload: RecorderToolbarStartPayload) => {
    lastTargetBounds = payload.targetBounds ?? null;
    repositionToolbar();
    ownerWindow?.webContents.send(IpcChannels.RecorderToolbarStartRequested, payload);
  });

  // Owner -> toolbar: whether that start actually succeeded, so the toolbar
  // can switch to its "Recording / Stop" mode or show the error and let the
  // user retry instead of being stuck on a dead "Starting..." button.
  ipcMain.on(
    IpcChannels.RecorderToolbarRecordingStarted,
    (_event, result: RecorderToolbarRecordingResult) => {
      toolbarWindow?.webContents.send(IpcChannels.RecorderToolbarRecordingStarted, result);
    }
  );

  // Toolbar's Stop button -> owner: run the real stop/save/editor-navigate
  // flow (useRecordingController.stop).
  ipcMain.on(IpcChannels.RecorderToolbarStop, () => {
    ownerWindow?.webContents.send(IpcChannels.RecorderToolbarStopRequested);
  });

  // Owner reports the recording is fully stopped and saved -- close the
  // toolbar and bring the owner (now on the editor route) back to front.
  ipcMain.on(IpcChannels.RecorderToolbarRecordingStopped, () => {
    closeRecorderToolbar();
  });
}

/** Best-effort cleanup on app quit -- mirrors destroyTray(). */
export function destroyRecorderToolbar(): void {
  const win = toolbarWindow;
  toolbarWindow = null;
  ownerWindow = null;
  lastTargetBounds = null;
  if (win && !win.isDestroyed()) win.destroy();
}
