import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  RecorderToolbarOpenPayload,
  RecorderToolbarStartPayload,
  RecorderToolbarRecordingResult
} from '@shared/recorder-toolbar';
import type { CaptureRegionSelection, ScreenRect } from '@shared/capture-region';
import { preloadScriptPath } from '../lib/preload-path';
import { minimizeCaptureWindow, restoreCaptureWindow } from './window-visibility';
import {
  hideRecordingRegionFrame,
  showRecordingRegionFrame
} from './recording-region-frame-window';

const TOOLBAR_WIDTH = 880;
const TOOLBAR_HEIGHT = 280;

// exact amount of headroom added.
const PILL_FOOTER_HEIGHT = 110;
const BOTTOM_MARGIN = 48;
const GAP_FROM_TARGET = 16;

let toolbarWindow: BrowserWindow | null = null;

let ownerWindow: BrowserWindow | null = null;

let lastTargetBounds: ScreenRect | null = null;
// Only set for an actual Area drag-selection, unlike lastTargetBounds above
// (which is also set for a full-display or Simulator/Emulator recording) --
// what gates the recording-region frame below, since a border around those
// wider cases wouldn't tell the user anything they don't already know.
let lastCropRegion: CaptureRegionSelection | null = null;

const INTERACTIVE_REGION_POLL_MS = 80;
let interactiveRegion: ScreenRect | null = null;
let interactiveRegionPoll: ReturnType<typeof setInterval> | null = null;
let toolbarIgnoringMouseEvents = false;

function pointInRect(point: { x: number; y: number }, rect: ScreenRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function startInteractiveRegionPoll(): void {
  if (interactiveRegionPoll) return;
  interactiveRegionPoll = setInterval(() => {
    if (!toolbarIgnoringMouseEvents || !interactiveRegion) return;
    if (!toolbarWindow || toolbarWindow.isDestroyed()) return;
    if (pointInRect(screen.getCursorScreenPoint(), interactiveRegion)) {
      toolbarIgnoringMouseEvents = false;
      toolbarWindow.setIgnoreMouseEvents(false);
    }
  }, INTERACTIVE_REGION_POLL_MS);
}

function stopInteractiveRegionPoll(): void {
  if (interactiveRegionPoll) {
    clearInterval(interactiveRegionPoll);
    interactiveRegionPoll = null;
  }
  interactiveRegion = null;
  toolbarIgnoringMouseEvents = false;
}

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

  win.setContentProtection(true);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (toolbarWindow === win) toolbarWindow = null;
    stopInteractiveRegionPoll();
  });

  startInteractiveRegionPoll();
  // Matches RecorderToolbarApp.tsx's own mount-time disablePointerEvents().
  toolbarIgnoringMouseEvents = true;
  win.setIgnoreMouseEvents(true);

  return win;
}

async function openRecorderToolbar(
  event: Electron.IpcMainInvokeEvent,
  payload: RecorderToolbarOpenPayload
): Promise<void> {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner) return;
  ownerWindow = owner;

  owner.webContents.setBackgroundThrottling(false);

  await minimizeCaptureWindow(owner);

  if (!toolbarWindow) toolbarWindow = createToolbarWindow();
  loadToolbarPage(toolbarWindow, payload);
}

/** Tears down the toolbar and brings the owning window back. */
function closeRecorderToolbar(): void {
  if (ownerWindow && !ownerWindow.isDestroyed()) {
    ownerWindow.webContents.setBackgroundThrottling(true);

    ownerWindow.webContents.send(IpcChannels.RecorderToolbarClosed);
  }
  void restoreCaptureWindow(ownerWindow, { focus: true });
  lastTargetBounds = null;
  lastCropRegion = null;
  hideRecordingRegionFrame();

  const win = toolbarWindow;
  toolbarWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

export function registerRecorderToolbarHandlers(): void {
  ipcMain.handle(IpcChannels.RecorderToolbarOpen, openRecorderToolbar);

  // Area picker: which display to open the crop overlay on. Bounds default
  // to the whole virtual desktop (see selectCaptureRegion), which is where
  // it'd otherwise always resolve against whichever display sorts first out
  // of screen.getAllDisplays() -- not necessarily the one the user's
  // actually looking at if they've dragged the toolbar to a different
  // monitor. Matching against the toolbar's own current bounds instead of
  // the cursor means it still works before the user has moved the mouse
  // onto the target monitor at all.
  ipcMain.handle(IpcChannels.RecorderToolbarGetCurrentDisplayBounds, (): ScreenRect | null => {
    if (!toolbarWindow || toolbarWindow.isDestroyed()) return null;
    return screen.getDisplayMatching(toolbarWindow.getBounds()).bounds;
  });

  // Toolbar's own click-through toggling -- see the interactive-region
  // poll above.
  ipcMain.handle(IpcChannels.WindowSetIgnoreMouseEvents, (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    toolbarIgnoringMouseEvents = ignore;
    win.setIgnoreMouseEvents(ignore);
  });

  // Toolbar reports the pill's current on-screen rect for the poll above.
  ipcMain.on(IpcChannels.WindowReportInteractiveRegion, (_event, region: ScreenRect | null) => {
    interactiveRegion = region;
  });

  ipcMain.on(IpcChannels.RecorderToolbarCancel, () => {
    closeRecorderToolbar();
  });

  ipcMain.on(IpcChannels.RecorderToolbarStart, (_event, payload: RecorderToolbarStartPayload) => {
    lastTargetBounds = payload.targetBounds ?? null;
    lastCropRegion = payload.cropRegion ?? null;
    repositionToolbar();
    ownerWindow?.webContents.send(IpcChannels.RecorderToolbarStartRequested, payload);
  });

  ipcMain.on(
    IpcChannels.RecorderToolbarRecordingStarted,
    (_event, result: RecorderToolbarRecordingResult) => {
      toolbarWindow?.webContents.send(IpcChannels.RecorderToolbarRecordingStarted, result);
      if (result.ok && lastCropRegion && lastTargetBounds) {
        showRecordingRegionFrame(lastTargetBounds);
      }
    }
  );

  ipcMain.on(IpcChannels.RecorderToolbarStop, () => {
    ownerWindow?.webContents.send(IpcChannels.RecorderToolbarStopRequested);
  });

  ipcMain.on(IpcChannels.RecorderToolbarRecordingStopped, () => {
    closeRecorderToolbar();
  });
}

export function destroyRecorderToolbar(): void {
  const win = toolbarWindow;
  toolbarWindow = null;
  ownerWindow = null;
  lastTargetBounds = null;
  lastCropRegion = null;
  stopInteractiveRegionPoll();
  hideRecordingRegionFrame();
  if (win && !win.isDestroyed()) win.destroy();
}
