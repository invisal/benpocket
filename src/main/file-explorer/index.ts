import { ipcMain, app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export type ListDirectoryResponse = { entries: FileEntry[] } | { error: string };

export interface SidebarItem {
  label: string;
  path: string;
}

export interface SidebarSections {
  favorites: SidebarItem[];
  locations: SidebarItem[];
}

export type ReadFileContentResponse =
  | { content: string }
  | { error: 'too-large'; maxBytes: number }
  | { error: 'unsupported-extension' }
  | { error: string };

const PREVIEWABLE_EXTENSIONS = new Set(['txt', 'md', 'json', 'ini']);
const MAX_PREVIEW_FILE_BYTES = 5 * 1024 * 1024;

const iconCache = new Map<string, string>();

function pathExists(target: string): boolean {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function getFavorites(): SidebarItem[] {
  const candidates: SidebarItem[] = [
    { label: 'Home', path: app.getPath('home') },
    { label: 'Desktop', path: app.getPath('desktop') },
    { label: 'Documents', path: app.getPath('documents') },
    { label: 'Downloads', path: app.getPath('downloads') }
  ];
  return candidates.filter((item) => pathExists(item.path));
}

function getWindowsLocations(): SidebarItem[] {
  const drives: SidebarItem[] = [];
  for (let code = 'C'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
    const letter = String.fromCharCode(code);
    const drivePath = `${letter}:\\`;
    if (pathExists(drivePath)) {
      drives.push({ label: `Local Disk (${letter}:)`, path: drivePath });
    }
  }
  return drives;
}

function getMacLocations(): SidebarItem[] {
  const locations: SidebarItem[] = [{ label: 'Macintosh HD', path: '/' }];
  try {
    const volumes = fs.readdirSync('/Volumes', { withFileTypes: true });
    for (const entry of volumes) {
      if (entry.name === 'Macintosh HD') continue;
      locations.push({ label: entry.name, path: path.join('/Volumes', entry.name) });
    }
  } catch {
    // /Volumes unreadable -- fall back to just the root volume
  }
  return locations;
}

function getLinuxLocations(): SidebarItem[] {
  const locations: SidebarItem[] = [{ label: 'Filesystem', path: '/' }];
  const mountRoots = [`/media/${os.userInfo().username}`, '/media', '/mnt'];
  for (const mountRoot of mountRoots) {
    try {
      const entries = fs.readdirSync(mountRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        locations.push({ label: entry.name, path: path.join(mountRoot, entry.name) });
      }
    } catch {
      // mount root doesn't exist or isn't readable -- skip it
    }
  }
  return locations;
}

function getLocations(): SidebarItem[] {
  switch (process.platform) {
    case 'win32':
      return getWindowsLocations();
    case 'darwin':
      return getMacLocations();
    default:
      return getLinuxLocations();
  }
}

export function registerFileExplorerHandlers(): void {
  ipcMain.handle('file-explorer:get-home-dir', () => {
    return app.getPath('home');
  });

  ipcMain.handle('file-explorer:get-sidebar-sections', (): SidebarSections => {
    return { favorites: getFavorites(), locations: getLocations() };
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

  ipcMain.handle(
    'file-explorer:read-file-content',
    async (_, filePath: string): Promise<ReadFileContentResponse> => {
      const extension = path.extname(filePath).replace(/^\./, '').toLowerCase();
      if (!PREVIEWABLE_EXTENSIONS.has(extension)) {
        return { error: 'unsupported-extension' };
      }

      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) return { error: 'Cannot preview a folder' };
        if (stats.size > MAX_PREVIEW_FILE_BYTES) {
          return { error: 'too-large', maxBytes: MAX_PREVIEW_FILE_BYTES };
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { content };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
