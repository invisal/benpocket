import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * One-time migration for a userData JSON store file that was renamed. Moves `oldFilename` to
 * `newFilename` if the new file doesn't exist yet but the old one does; a no-op afterward, so
 * it's safe to call on every read.
 */
export async function migrateStoreFile(oldFilename: string, newFilename: string): Promise<void> {
  const dir = app.getPath('userData');
  const newPath = path.join(dir, newFilename);
  try {
    await fs.promises.access(newPath);
    return;
  } catch {
    // New file doesn't exist yet - fall through to attempt the migration.
  }
  try {
    await fs.promises.rename(path.join(dir, oldFilename), newPath);
  } catch {
    // Old file doesn't exist either (fresh install) - nothing to migrate.
  }
}
