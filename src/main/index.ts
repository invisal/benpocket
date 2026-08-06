import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import * as fs from 'fs';
import * as path from 'path';
import { registerHttpHandlers } from './http-client/ipc/http';
import { registerOAuth2Handlers } from './http-client/ipc/oauth2';
import {
  registerWebSocketHandlers,
  closeAllWebSocketConnections
} from './http-client/ipc/websocket';
import { registerCollectionHandlers } from './http-client/ipc/collections';
import { registerCollectionTransferHandlers } from './http-client/ipc/collectionsTransfer';
import { registerEnvironmentHandlers } from './http-client/ipc/environments';
import { registerEnvironmentTransferHandlers } from './http-client/ipc/environmentsTransfer';
import { registerWorkspaceHandlers } from './http-client/ipc/workspaces';
import { registerIpcHandlers as registerScreenRecorderHandlers } from './screen-recorder/ipc/register-handlers';
import { applyContentSecurityPolicy } from './screen-recorder/security/content-security-policy';
import { createAppTray, destroyTray, setTrayMainWindow } from './tray';
import {
  registerGlobalShortcuts,
  unregisterGlobalShortcuts
} from './screen-recorder/shortcuts/global-shortcuts';
import { destroyRecorderToolbar } from './screen-recorder/windows/recorder-toolbar-window';
import { destroySourcePickerOverlay } from './screen-recorder/windows/source-picker-overlay-window';
import { registerDisplayMediaHandler } from './screen-recorder/security/display-media-handler';
import { killActiveNativeRecording } from './screen-recorder/capture/native/recording-helper';
import { registerKuberneterHandlers } from './kuberneter';
import { registerFileExplorerHandlers } from './file-explorer';
import { registerProfileHandlers, closeAllProfileSessions } from './store/ipc';
import { registerDeepLinkHandler } from './auth/deepLink';
import { handleGithubDeepLink } from './auth/githubAuth';
import { registerAuthHandlers } from './auth/ipc';
import { registerUpdaterHandlers } from './updater/ipc';
import { registerTelemetryHandlers } from './telemetry/ipc';
import { telemetryStore } from './telemetry/telemetry-store';
import { flushOnQuit, startTelemetrySender } from './telemetry/sender';

// Must run before app.whenReady(): app.requestSingleInstanceLock() has to be
// called this early for `second-instance` (Windows/Linux deep-link delivery,
// see auth/deepLink.ts) to work at all, and `open-url` (macOS) can fire
// before the app is ready. A second launch (e.g. the OS re-invoking the app
// to deliver a benpocket:// callback) now gets forwarded to this instance and
// quits instead of opening a second window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  registerDeepLinkHandler(handleGithubDeepLink);
}

// Everything below only runs if this process actually won the single-instance
// lock above -- otherwise app.quit() is already in flight, and registering a
// window/IPC handlers here would race it into briefly existing anyway.
if (gotSingleInstanceLock) {
  /** When true, window `close` is allowed to destroy the window (Quit path). */
  let isQuitting = false;

  /** Show/focus the existing main window (second launch, dock activate, etc.). */
  function focusMainWindow(): void {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    setTrayMainWindow(win);
  }

  // Deep-link handler also listens on `second-instance` for benpocket:// URLs;
  // this listener focuses the tray instance on any second launch.
  app.on('second-instance', () => {
    focusMainWindow();
  });

  function createWindow(): BrowserWindow {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      frame: process.platform === 'darwin' ? true : false,
      titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    });

    mainWindow.on('ready-to-show', () => {
      mainWindow.show();
    });

    // Close (X) hides to tray; real quit only via tray Quit / Cmd+Q / app menu.
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    mainWindow.webContents.on('context-menu', (event, params) => {
      // Chromium doesn't build a menu on its own for plain (non-editable)
      // areas, so the native right-click menu is suppressed there. Editable
      // fields always get Cut/Copy/Paste/Select All since nothing else
      // provides that.
      event.preventDefault();

      if (!params.isEditable) return;

      const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' }
      ];

      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    setTrayMainWindow(mainWindow);
    return mainWindow;
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');

    // Replaces index.html's static CSP meta tag: needs to differ between dev
    // (Vite HMR needs 'unsafe-eval' + a websocket connect-src) and production,
    // and needs media-src blob: for ScreenRecorder's recording preview.
    applyContentSecurityPolicy();
    // Screen Recorder: macOS 15+ ScreenCaptureKit system picker. No-op elsewhere.
    registerDisplayMediaHandler();

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // IPC test
    ipcMain.on('ping', () => console.log('pong'));

    ipcMain.on('window-minimize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.minimize();
    });

    ipcMain.on('window-maximize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
    });

    ipcMain.on('window-close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      // Hits the close handler above → hide to tray unless quitting.
      if (win) win.close();
    });

    ipcMain.handle('open-directory', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return null;

      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const dirPath = result.filePaths[0];

      interface FileTreeNode {
        name: string;
        path: string;
        isDirectory: boolean;
        children?: FileTreeNode[];
      }

      async function buildTree(currentPath: string, depth = 0): Promise<FileTreeNode | null> {
        if (depth > 3) return null; // Prevent deep recursion
        try {
          const name = path.basename(currentPath);
          const stats = await fs.promises.stat(currentPath);
          if (stats.isDirectory()) {
            const files = await fs.promises.readdir(currentPath);
            const children = await Promise.all(
              files
                .filter((f) => !f.startsWith('.') && f !== 'node_modules')
                .map((file) => buildTree(path.join(currentPath, file), depth + 1))
            );
            return {
              name,
              path: currentPath,
              isDirectory: true,
              children: children.filter((child): child is FileTreeNode => child !== null)
            };
          } else {
            return {
              name,
              path: currentPath,
              isDirectory: false
            };
          }
        } catch (err) {
          console.error('Error reading path:', currentPath, err);
          return null;
        }
      }

      const tree = await buildTree(dirPath);
      return {
        path: dirPath,
        tree
      };
    });

    // API testing client (REST + WebSocket) - all networking runs here in the
    // main process to avoid renderer CORS restrictions and keep sockets alive
    // across renderer tab switches / reloads.
    registerHttpHandlers();
    registerOAuth2Handlers();
    registerWebSocketHandlers();
    registerCollectionHandlers();
    registerCollectionTransferHandlers();
    registerEnvironmentHandlers();
    registerEnvironmentTransferHandlers();
    registerWorkspaceHandlers();

    // Recording capture, project persistence, export, settings, window
    // controls, screen-recording permissions, and export-path dialogs for the
    // ScreenRecorder tool (src/main/screen-recorder/ipc/*-handlers.ts).
    registerScreenRecorderHandlers();

    // Kuberneter contexts selection and live resources query handlers
    registerKuberneterHandlers();

    // File Explorer tool: directory listing, native file icons, open-with-default-app
    registerFileExplorerHandlers();

    // Profile state (active profile + list of profiles), backing the activity
    // bar's profile switcher.
    registerProfileHandlers();

    // GitHub OAuth login + master-password DEK setup/unlock -- see
    // src/main/store/PLAN3.md.
    registerAuthHandlers();

    // Manual update checking via electron-updater against GitHub Releases --
    // see src/main/updater/ipc.ts. Runs one check at startup; no polling, no
    // silent download/install, everything else is gated behind the status
    // bar's UpdateStatus click.
    registerUpdaterHandlers();

    // Usage tracking (see docs/telemetry.md) -- opt-out, install-scoped, never
    // carries tool content. registerTelemetryHandlers() exposes window.telemetry;
    // startTelemetrySender() periodically flushes the local queue to the backend.
    registerTelemetryHandlers();
    startTelemetrySender();
    telemetryStore.enqueue({ event: 'app_opened' });

    const mainWindow = createWindow();
    createAppTray(icon, mainWindow);

    // "Launch Recorder" OS-level shortcut -- works even while benpocket is
    // unfocused, unlike the in-app bindings under features/shortcuts.
    registerGlobalShortcuts(mainWindow);

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createAppTray(icon, createWindow());
        return;
      }
      focusMainWindow();
    });
  });

  // Close-to-tray: do not quit when the last window is closed/hidden.
  // Explicit Quit (tray / Cmd+Q) is the only exit path.
  app.on('window-all-closed', () => {
    closeAllWebSocketConnections();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    closeAllProfileSessions();
    unregisterGlobalShortcuts();
    destroyTray();
    destroyRecorderToolbar();
    destroySourcePickerOverlay();
    // Safety net if the renderer never gets to send a normal stop -- kills
    // any still-running native recording helper subprocess rather than
    // leaving it (and, on macOS, the OS-level "recording" indicator) behind.
    killActiveNativeRecording();
    // Best-effort, ~2s-bounded final flush -- never blocks shutdown.
    void flushOnQuit();
  });
}
