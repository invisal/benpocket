import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import * as fs from 'fs';
import * as path from 'path';
import { registerHttpHandlers } from './http-client/ipc/http';
import {
  registerWebSocketHandlers,
  closeAllWebSocketConnections
} from './http-client/ipc/websocket';
import { registerCollectionHandlers } from './http-client/ipc/collections';
import { registerCollectionTransferHandlers } from './http-client/ipc/collectionsTransfer';
import { registerEnvironmentHandlers } from './http-client/ipc/environments';
import { registerIpcHandlers as registerScreenRecorderHandlers } from './screen-recorder/ipc/register-handlers';
import { applyContentSecurityPolicy } from './screen-recorder/security/content-security-policy';
import { registerKuberneterHandlers } from './kuberneter';
import { registerFileExplorerHandlers } from './file-explorer';

function createWindow(): void {
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
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
  registerWebSocketHandlers();
  registerCollectionHandlers();
  registerCollectionTransferHandlers();
  registerEnvironmentHandlers();

  // Recording capture, project persistence, export, settings, window
  // controls, screen-recording permissions, and export-path dialogs for the
  // ScreenRecorder tool (src/main/screen-recorder/ipc/*-handlers.ts).
  registerScreenRecorderHandlers();

  // Kuberneter contexts selection and live resources query handlers
  registerKuberneterHandlers();

  // File Explorer tool: directory listing, native file icons, open-with-default-app
  registerFileExplorerHandlers();

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  closeAllWebSocketConnections();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
