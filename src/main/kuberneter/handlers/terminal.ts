import { ipcMain, BrowserWindow, app } from 'electron';
import { KubeTerminalService, type TerminalSpawnOptions } from '../services/KubeTerminalService';

/** Tracks which sender owns which terminal id, for targeted teardown. */
const sessionOwners = new Map<string, number>();

export function registerTerminalHandler(): void {
  ipcMain.handle(
    'kuberneter:terminal-create',
    (event, id: string, options: TerminalSpawnOptions) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const webContentsId = event.sender.id;
      sessionOwners.set(id, webContentsId);

      KubeTerminalService.create(
        id,
        options,
        (data) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('kuberneter:terminal-data', id, data);
          }
        },
        (exitCode, signal) => {
          sessionOwners.delete(id);
          if (window && !window.isDestroyed()) {
            window.webContents.send('kuberneter:terminal-exit', id, exitCode, signal);
          }
        }
      );

      return { success: true };
    }
  );

  ipcMain.on('kuberneter:terminal-input', (_event, id: string, data: string) => {
    KubeTerminalService.write(id, data);
  });

  ipcMain.on('kuberneter:terminal-resize', (_event, id: string, cols: number, rows: number) => {
    KubeTerminalService.resize(id, cols, rows);
  });

  ipcMain.handle('kuberneter:terminal-dispose', (_event, id: string) => {
    sessionOwners.delete(id);
    KubeTerminalService.dispose(id);
    return { success: true };
  });

  // Kill sessions owned by a renderer that goes away (tab close / reload).
  app.on('web-contents-created', (_e, contents) => {
    contents.on('destroyed', () => {
      for (const [id, ownerId] of Array.from(sessionOwners.entries())) {
        if (ownerId === contents.id) {
          KubeTerminalService.dispose(id);
          sessionOwners.delete(id);
        }
      }
    });
  });

  app.on('will-quit', () => {
    KubeTerminalService.disposeAll();
  });
}
