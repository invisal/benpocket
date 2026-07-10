import { ipcMain, app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export type ListDirectoryResponse = { entries: FileEntry[] } | { error: string };

const iconCache = new Map<string, string>();

export function registerFileExplorerHandlers(): void {
  ipcMain.handle('file-explorer:get-home-dir', () => {
    return app.getPath('home');
  });

  ipcMain.handle(
    'file-explorer:list-directory',
    async (_, dirPath: string): Promise<ListDirectoryResponse> => {
      try {
        const names = await fs.promises.readdir(dirPath);
        const entries = await Promise.all(
          names.map(async (name): Promise<FileEntry | null> => {
            const fullPath = path.join(dirPath, name);
            try {
              const stats = await fs.promises.stat(fullPath);
              const extension = stats.isDirectory()
                ? ''
                : path.extname(name).replace(/^\./, '').toLowerCase();
              return {
                name,
                path: fullPath,
                isDirectory: stats.isDirectory(),
                size: stats.isDirectory() ? 0 : stats.size,
                modifiedMs: stats.mtimeMs,
                extension
              };
            } catch {
              return null;
            }
          })
        );
        return { entries: entries.filter((entry): entry is FileEntry => entry !== null) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  ipcMain.handle(
    'file-explorer:get-file-icon',
    async (_, filePath: string, extension: string): Promise<string | null> => {
      const cacheKey = extension || `__noext__:${path.basename(filePath).toLowerCase()}`;
      const cached = iconCache.get(cacheKey);
      if (cached) return cached;

      try {
        const icon = await app.getFileIcon(filePath, { size: 'small' });
        const dataUrl = icon.toDataURL();
        iconCache.set(cacheKey, dataUrl);
        return dataUrl;
      } catch {
        return null;
      }
    }
  );

  ipcMain.handle(
    'file-explorer:open-path',
    async (_, targetPath: string): Promise<{ success: true } | { error: string }> => {
      const errorMessage = await shell.openPath(targetPath);
      return errorMessage ? { error: errorMessage } : { success: true };
    }
  );
}
