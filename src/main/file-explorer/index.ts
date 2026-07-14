import { ipcMain, app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readFilesFromClipboard,
  writeFilesToClipboard,
  type ClipboardMode
} from './nativeClipboard';
import { pathExists } from './localFileDriver';
import { getDriverForLocation } from './driverRegistry';
import { getR2Credential, registerR2CredentialHandlers } from './r2Credential';
import { listR2Buckets } from './r2FileDriver';
import {
  type CreateResult,
  type ListDirectoryResult,
  type MutationResult,
  type ReadFileResult,
  type WriteFileResult
} from './fileDriver';

export type { FileEntry } from './fileDriver';

export interface SidebarItem {
  label: string;
  path: string;
}

export interface SidebarSections {
  favorites: SidebarItem[];
  locations: SidebarItem[];
  r2Buckets: SidebarItem[];
}

const iconCache = new Map<string, string>();

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

async function getR2BucketSidebarItems(): Promise<SidebarItem[]> {
  // Not configured -- R2 stays entirely absent from the sidebar rather than
  // showing an error state, matching Step 7's "opt-in, not an error" design.
  if (!getR2Credential()) return [];

  const buckets = await listR2Buckets();
  if ('error' in buckets) return [];

  return buckets.map((bucket) => ({ label: bucket.name, path: `r2://${bucket.name}/` }));
}

export function registerFileExplorerHandlers(): void {
  registerR2CredentialHandlers();

  ipcMain.handle('file-explorer:get-home-dir', () => {
    return app.getPath('home');
  });

  ipcMain.handle('file-explorer:get-sidebar-sections', async (): Promise<SidebarSections> => {
    return {
      favorites: getFavorites(),
      locations: getLocations(),
      r2Buckets: await getR2BucketSidebarItems()
    };
  });

  ipcMain.handle(
    'file-explorer:list-directory',
    async (_, uri: string, cursor?: string): Promise<ListDirectoryResult> => {
      return getDriverForLocation(uri).listDirectory(uri, cursor);
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
    async (_, uri: string): Promise<ReadFileResult> => {
      return getDriverForLocation(uri).readFile(uri);
    }
  );

  ipcMain.handle(
    'file-explorer:write-file-content',
    async (_, uri: string, content: string): Promise<WriteFileResult> => {
      return getDriverForLocation(uri).writeFile(uri, content);
    }
  );

  ipcMain.handle(
    'file-explorer:delete-entries',
    async (_, uris: string[]): Promise<MutationResult> => {
      if (uris.length === 0) return { success: true };
      return getDriverForLocation(uris[0]).deleteEntries(uris);
    }
  );

  ipcMain.handle(
    'file-explorer:copy-entries',
    async (_, sourceUris: string[], destDirUri: string): Promise<MutationResult> => {
      return getDriverForLocation(destDirUri).copyEntries(sourceUris, destDirUri);
    }
  );

  ipcMain.handle(
    'file-explorer:move-entries',
    async (_, sourceUris: string[], destDirUri: string): Promise<MutationResult> => {
      return getDriverForLocation(destDirUri).moveEntries(sourceUris, destDirUri);
    }
  );

  ipcMain.handle(
    'file-explorer:clipboard-write',
    async (_, paths: string[], mode: ClipboardMode): Promise<void> => {
      await writeFilesToClipboard(paths, mode);
    }
  );

  ipcMain.handle('file-explorer:clipboard-read', async () => {
    return readFilesFromClipboard();
  });

  ipcMain.handle(
    'file-explorer:create-file',
    async (_, destDirUri: string, name: string): Promise<CreateResult> => {
      return getDriverForLocation(destDirUri).createFile(destDirUri, name);
    }
  );

  ipcMain.handle(
    'file-explorer:create-folder',
    async (_, destDirUri: string, name: string): Promise<CreateResult> => {
      return getDriverForLocation(destDirUri).createFolder(destDirUri, name);
    }
  );
}
