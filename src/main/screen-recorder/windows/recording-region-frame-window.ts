import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import type { ScreenRect } from '@shared/capture-region';

// Purely decorative, click-through outline shown around the bounds actually
// being captured (Area crop, or a Simulator/Emulator window -- see
// lastTargetBounds in recorder-toolbar-window.ts) while a recording is in
// progress, so the user has a persistent on-screen reminder of what's in
// frame. setContentProtection keeps it out of the recording itself (same
// mechanism the toolbar pill already relies on -- see its own comment).
let frameWindow: BrowserWindow | null = null;

function loadFramePage(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/recording-region-frame.html`);
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/recording-region-frame.html'));
}

function boundsFor(rect: ScreenRect): Electron.Rectangle {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

export function showRecordingRegionFrame(rect: ScreenRect): void {
  if (frameWindow && !frameWindow.isDestroyed()) {
    frameWindow.setBounds(boundsFor(rect));
    return;
  }

  const win = new BrowserWindow({
    ...boundsFor(rect),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { sandbox: false, contextIsolation: true }
  });

  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(true);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (frameWindow === win) frameWindow = null;
  });

  frameWindow = win;
  loadFramePage(win);
}

export function hideRecordingRegionFrame(): void {
  const win = frameWindow;
  frameWindow = null;
  if (win && !win.isDestroyed()) win.close();
}
