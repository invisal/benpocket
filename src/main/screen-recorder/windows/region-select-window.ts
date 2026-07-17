import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureRegionSelection,
  RegionSelectCompletePayload,
  ScreenRect,
  SelectCaptureRegionOptions
} from '@shared/capture-region';
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

function loadRegionSelectPage(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/region-select.html`);
    return;
  }

  void win.loadFile(join(__dirname, '../renderer/region-select.html'));
}

let regionWindow: BrowserWindow | null = null;
let resolveSelection: ((value: CaptureRegionSelection | null) => void) | null = null;
let selectionFinished = false;
/** JPEG bytes or legacy data-URL string for the overlay backdrop. */
let backdropPayload: ArrayBuffer | string | null = null;
let exclusiveFullscreen = false;
/** Wayland: map the drag in overlay-local space rather than global screen coords. */
let overlayRelative = false;

function finishSelection(value: CaptureRegionSelection | null): void {
  if (selectionFinished) return;
  selectionFinished = true;

  const win = regionWindow;
  regionWindow = null;
  backdropPayload = null;
  exclusiveFullscreen = false;
  overlayRelative = false;
  const resolve = resolveSelection;
  resolveSelection = null;

  if (!win) {
    resolve?.(value);
    return;
  }

  win.once('closed', () => resolve?.(value));
  // Destroy immediately — waiting for leave-full-screen adds a visible delay.
  if (!win.isDestroyed()) win.destroy();
}

function isImageSpacePayload(
  payload: RegionSelectCompletePayload
): payload is Extract<RegionSelectCompletePayload, { imageSpace: true }> {
  return typeof payload === 'object' && 'imageSpace' in payload && payload.imageSpace === true;
}

function onRegionComplete(
  _event: Electron.IpcMainEvent,
  payload: RegionSelectCompletePayload
): void {
  if (!resolveSelection) {
    finishSelection(null);
    return;
  }

  if (isImageSpacePayload(payload)) {
    if (payload.rect.width < 2 || payload.rect.height < 2) {
      finishSelection(null);
      return;
    }
    finishSelection({
      rect: payload.rect,
      displayBounds: {
        x: 0,
        y: 0,
        width: payload.imageWidth,
        height: payload.imageHeight
      },
      scaleFactor: 1,
      imageSpace: true
    });
    return;
  }

  if (payload.width < 2 || payload.height < 2) {
    finishSelection(null);
    return;
  }

  const win = regionWindow;

  // Wayland: the window's absolute position is not knowable, so keep the drag
  // in overlay-local pixels and hand back the overlay's own size as the
  // reference box. The renderer then scales by capturedFrame/overlaySize --
  // no global-coordinate hop, which is what caused the offset.
  if (overlayRelative) {
    const size = win?.getContentBounds() ?? { width: payload.width, height: payload.height };
    finishSelection({
      rect: { x: payload.x, y: payload.y, width: payload.width, height: payload.height },
      displayBounds: { x: 0, y: 0, width: size.width, height: size.height },
      scaleFactor: 1
    });
    return;
  }

  const origin = win?.getContentBounds() ?? { x: 0, y: 0 };
  const rect: ScreenRect = {
    x: origin.x + payload.x,
    y: origin.y + payload.y,
    width: payload.width,
    height: payload.height
  };

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

function readContentOrigin(win: BrowserWindow): ScreenRect {
  const bounds = win.getContentBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

async function waitForOverlaySettle(win: BrowserWindow): Promise<void> {
  if (!win.isVisible()) {
    await new Promise<void>((resolve) => win.once('show', () => resolve()));
  }

  if (exclusiveFullscreen && !win.isFullScreen() && !win.isSimpleFullScreen()) {
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      win.once('enter-full-screen', done);
      setTimeout(done, 80);
    });
  }

  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function onRegionGetContentOrigin(
  event: Electron.IpcMainInvokeEvent
): Promise<ScreenRect | null> {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win !== regionWindow) return null;

  await waitForOverlaySettle(win);
  return readContentOrigin(win);
}

function onRegionGetBackdrop(): ArrayBuffer | string | null {
  return backdropPayload;
}

export function registerRegionSelectListeners(): void {
  ipcMain.on(IpcChannels.RegionSelectComplete, onRegionComplete);
  ipcMain.on(IpcChannels.RegionSelectCancel, onRegionCancel);
  ipcMain.handle(IpcChannels.RegionSelectGetContentOrigin, onRegionGetContentOrigin);
  ipcMain.handle(IpcChannels.RegionSelectGetBackdrop, onRegionGetBackdrop);
}

export function selectCaptureRegion(
  options?: SelectCaptureRegionOptions
): Promise<CaptureRegionSelection | null> {
  if (resolveSelection) {
    finishSelection(null);
  }

  return new Promise((resolve) => {
    selectionFinished = false;
    resolveSelection = resolve;
    backdropPayload =
      options?.backdropJpeg != null
        ? options.backdropJpeg.slice(0)
        : (options?.backdropDataUrl ?? null);
    overlayRelative = options?.overlayRelative ?? false;
    const bounds = options?.bounds ?? getVirtualDesktopBounds();
    const hasBackdrop = Boolean(backdropPayload);
    // Fullscreen ONLY for an opaque backdrop overlay. A transparent overlay
    // (the live dim-the-desktop mode) must never be fullscreen: transparent +
    // fullscreen on Linux/Wayland renders as solid black, hiding the desktop
    // the user is trying to select. Non-fullscreen + setBounds still covers the
    // display.
    exclusiveFullscreen = hasBackdrop;

    regionWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: !hasBackdrop,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      focusable: true,
      fullscreenable: true,
      // Start fullscreen immediately — avoids a post-show GNOME animation gap.
      fullscreen: exclusiveFullscreen && process.platform !== 'darwin',
      show: false,
      backgroundColor: hasBackdrop ? '#000000' : '#00000000',
      ...(process.platform === 'darwin'
        ? { enableLargerThanScreen: true, roundedCorners: false }
        : {}),
      ...(process.platform === 'win32' ? { thickFrame: false } : {}),
      webPreferences: {
        preload: preloadScriptPath(),
        sandbox: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    });

    regionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    regionWindow.setAlwaysOnTop(true, 'screen-saver');
    regionWindow.once('ready-to-show', () => {
      const win = regionWindow;
      if (!win) return;
      if (process.platform === 'darwin' && exclusiveFullscreen) {
        win.setSimpleFullScreen(true);
      }
      win.show();
      win.focus();
      if (!exclusiveFullscreen) {
        win.setBounds(bounds);
      }
    });
    regionWindow.on('closed', () => {
      if (!selectionFinished) finishSelection(null);
    });

    loadRegionSelectPage(regionWindow);
  });
}
