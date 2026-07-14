import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  MAX_PREVIEW_FILE_BYTES,
  PREVIEWABLE_EXTENSIONS,
  type CreateResult,
  type DriverCapabilities,
  type FileDriver,
  type FileEntry,
  type ListDirectoryResult,
  type MutationResult,
  type ReadFileResult,
  type WriteFileResult
} from './fileDriver';

export function pathExists(target: string): boolean {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

async function getAvailableName(destDir: string, baseName: string): Promise<string> {
  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);

  let candidate = baseName;
  let attempt = 1;
  while (pathExists(path.join(destDir, candidate))) {
    attempt += 1;
    candidate = `${stem} (${attempt})${extension}`;
  }
  return candidate;
}

const capabilities: DriverCapabilities = {
  trash: true,
  nativeIcons: true,
  atomicMove: true,
  realFolders: true,
  sync: 'sync'
};

export const localFileDriver: FileDriver = {
  id: 'local',
  capabilities,

  async listDirectory(uri): Promise<ListDirectoryResult> {
    try {
      const names = await fs.promises.readdir(uri);
      const entries = await Promise.all(
        names.map(async (name): Promise<FileEntry | null> => {
          const fullPath = path.join(uri, name);
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
      // Local listings always resolve in a single page.
      return {
        entries: entries.filter((entry): entry is FileEntry => entry !== null),
        nextCursor: null
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async readFile(uri): Promise<ReadFileResult> {
    const extension = path.extname(uri).replace(/^\./, '').toLowerCase();
    if (!PREVIEWABLE_EXTENSIONS.has(extension)) {
      return { error: 'unsupported-extension' };
    }

    try {
      const stats = await fs.promises.stat(uri);
      if (stats.isDirectory()) return { error: 'Cannot preview a folder' };
      if (stats.size > MAX_PREVIEW_FILE_BYTES) {
        return { error: 'too-large', maxBytes: MAX_PREVIEW_FILE_BYTES };
      }

      const content = await fs.promises.readFile(uri, 'utf-8');
      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async writeFile(uri, content): Promise<WriteFileResult> {
    const extension = path.extname(uri).replace(/^\./, '').toLowerCase();
    if (!PREVIEWABLE_EXTENSIONS.has(extension)) {
      return { error: 'unsupported-extension' };
    }

    try {
      const stats = await fs.promises.stat(uri);
      if (stats.isDirectory()) return { error: 'Cannot write to a folder' };

      await fs.promises.writeFile(uri, content, 'utf-8');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async deleteEntries(uris): Promise<MutationResult> {
    try {
      for (const target of uris) {
        await shell.trashItem(target);
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async copyEntries(sourceUris, destDirUri): Promise<MutationResult> {
    try {
      for (const source of sourceUris) {
        const name = await getAvailableName(destDirUri, path.basename(source));
        await fs.promises.cp(source, path.join(destDirUri, name), { recursive: true });
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async moveEntries(sourceUris, destDirUri): Promise<MutationResult> {
    try {
      for (const source of sourceUris) {
        const name = await getAvailableName(destDirUri, path.basename(source));
        const destination = path.join(destDirUri, name);
        try {
          await fs.promises.rename(source, destination);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
          // Source and destination are on different filesystems/devices --
          // rename can't cross that boundary, so fall back to copy + remove.
          await fs.promises.cp(source, destination, { recursive: true });
          await fs.promises.rm(source, { recursive: true });
        }
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async createFile(destDirUri, name): Promise<CreateResult> {
    const fullPath = path.join(destDirUri, name);
    try {
      // The 'wx' flag fails atomically if the file already exists, avoiding a
      // separate existence-check race between checking and writing.
      await fs.promises.writeFile(fullPath, '', { flag: 'wx' });
      return { success: true, path: fullPath };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') return { error: 'exists' };
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  },

  async createFolder(destDirUri, name): Promise<CreateResult> {
    const fullPath = path.join(destDirUri, name);
    try {
      await fs.promises.mkdir(fullPath);
      return { success: true, path: fullPath };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') return { error: 'exists' };
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
};
