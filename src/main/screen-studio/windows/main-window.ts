import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { forwardMaximizeState } from '../ipc/window-handlers';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // Fully custom, cross-platform titlebar (see app/layout/TitleBar.tsx) --
    // no native traffic lights/frame on any platform, matching the design.
    // The renderer marks its titlebar row `-webkit-app-region: drag` and
    // marks buttons within it `no-drag`; the actual minimize/maximize/close
    // actions go over IPC (see ipc/window-handlers.ts).
    frame: false,
    // Matches the dark theme background so there's no white/black flash
    // before the renderer paints, and gives a visible fallback if the
    // renderer fails to mount for some reason.
    backgroundColor: '#0f0f12',
    webPreferences: {
      // NOTE: with `"type": "module"` in package.json, electron-vite builds
      // the preload bundle as an ES module and emits it as `index.mjs`
      // (unlike the main bundle, which is also ESM but keeps the `.js`
      // extension). Pointing this at `index.js` silently fails to load the
      // preload script -- `window.screenStudio` never gets exposed, and
      // React crashes on the first IPC call, producing a blank/black window
      // with no visible error. Keep this in sync with electron.vite.config.ts's
      // preload build output.
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  });

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[main] preload script failed to load:', preloadPath, error);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[main] renderer failed to load:', errorCode, errorDescription);
  });

  win.once('ready-to-show', () => win.show());

  forwardMaximizeState(win);

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    // Auto-open DevTools in dev so future preload/renderer errors are
    // immediately visible instead of showing up as a silent blank window.
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
