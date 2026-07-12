import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { CaptureRegionSelection, ScreenRect } from '@shared/capture-region';
import { preloadScriptPath } from '../lib/preload-path';

function getVirtualDesktopBounds(): ScreenRect {
  const displays = screen.getAllDisplays();
  let x = Infinity;
  let y = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const display of displays) {
    x = Math.min(x, display.bounds.x);
    y = Math.min(y, display.bounds.y);
    right = Math.max(right, display.bounds.x + display.bounds.width);
    bottom = Math.max(bottom, display.bounds.y + display.bounds.height);
  }

  return { x, y, width: right - x, height: bottom - y };
}

function loadRegionSelectPage(win: BrowserWindow, bounds: ScreenRect): void {
  const query = new URLSearchParams({
    ox: String(bounds.x),
    oy: String(bounds.y),
    w: String(bounds.width),
    h: String(bounds.height)
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/region-select.html?${query}`);
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/region-select.html'), {
    search: query.toString()
  });
}

let regionWindow: BrowserWindow | null = null;
let resolveSelection: ((value: CaptureRegionSelection | null) => void) | null = null;
let selectionFinished = false;

function finishSelection(value: CaptureRegionSelection | null): void {
  if (selectionFinished) return;
  selectionFinished = true;

  const win = regionWindow;
  regionWindow = null;
  const resolve = resolveSelection;
  resolveSelection = null;

  if (!win) {
    resolve?.(value);
    return;
  }

  win.once('closed', () => resolve?.(value));
  win.close();
}

function onRegionComplete(_event: Electron.IpcMainEvent, rect: ScreenRect): void {
  if (!resolveSelection || rect.width < 2 || rect.height < 2) {
    finishSelection(null);
    return;
  }

  const display = screen.getDisplayMatching(rect);
  finishSelection({
    rect,
    displayBounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    },
    scaleFactor: display.scaleFactor
  });
}

function onRegionCancel(): void {
  finishSelection(null);
}

export function registerRegionSelectListeners(): void {
  ipcMain.on(IpcChannels.RegionSelectComplete, onRegionComplete);
  ipcMain.on(IpcChannels.RegionSelectCancel, onRegionCancel);
}

export function selectCaptureRegion(): Promise<CaptureRegionSelection | null> {
  if (resolveSelection) {
    finishSelection(null);
  }

  return new Promise((resolve) => {
    selectionFinished = false;
    resolveSelection = resolve;
    const bounds = getVirtualDesktopBounds();

    regionWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      focusable: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadScriptPath(),
        sandbox: false,
        contextIsolation: true
      }
    });

    regionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    regionWindow.once('ready-to-show', () => regionWindow?.show());
    regionWindow.on('closed', () => {
      if (!selectionFinished) finishSelection(null);
    });

    loadRegionSelectPage(regionWindow, bounds);
  });
}
