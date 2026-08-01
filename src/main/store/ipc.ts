import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { createProfileManager, type ProfileManager } from './profileManager';
import type { CreateProfileOptions, ProfileDescriptor, ProfileId } from './types';

interface SwitchProfileResult {
  ok: boolean;
  error?: string;
}

type CreateProfileResult = { ok: true; profile: ProfileDescriptor } | { ok: false; error: string };

type SyncResult = { ok: true } | { ok: false; error: string };

type SyncStatusResult =
  | { ok: true; hasChanges: boolean; latestSeq: number; count: number }
  | { ok: false; error: string };

const MOCK_SERVER_FILE_FILTERS = [{ name: 'SQLite Database', extensions: ['db'] }];

let manager: ProfileManager | undefined;

/** Lazily created so tests / other main-process modules can import this file without touching electron's app.getPath. */
function getProfileManager(): ProfileManager {
  if (!manager) {
    manager = createProfileManager(join(app.getPath('userData'), 'profiles'));
    manager.ensureDefaultLocalProfile();
  }
  return manager;
}

/**
 * Pushes the active profile's current unpushed-patch count to every window,
 * so the status bar's sync indicator stays live without the renderer polling
 * or manually refetching -- called after anything that can change it
 * (appendPatch, sync, switchProfile, delete).
 */
function broadcastUnpushedCount(): void {
  void getProfileManager()
    .getUnpushedPatchCount()
    .then((count) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('profiles:unpushed-count-changed', count);
      }
    });
}

/**
 * Pushes the docKeys that received new remote patches via sync(), so an
 * already-mounted usePersistStore for one of those keys can merge in the
 * change instead of silently going stale until it happens to remount. No-op
 * if nothing changed.
 */
function broadcastDocsChanged(keys: string[]): void {
  if (keys.length === 0) return;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('profiles:docs-changed', keys);
  }
}

export function registerProfileHandlers(): void {
  // Guarantees a default "Personal" profile exists before the renderer ever
  // asks -- mirrors migrateWorkspaceData()'s startup role for workspaces.
  getProfileManager();

  ipcMain.handle('profiles:list', (): ProfileDescriptor[] => {
    return getProfileManager().list();
  });

  ipcMain.handle('profiles:get-active', (): ProfileDescriptor => {
    return getProfileManager().getActive();
  });

  ipcMain.handle('profiles:switch', (_event, profileId: ProfileId): SwitchProfileResult => {
    try {
      getProfileManager().switchProfile(profileId);
      broadcastUnpushedCount();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' };
    }
  });

  ipcMain.handle(
    'profiles:create',
    (_event, options: CreateProfileOptions): CreateProfileResult => {
      try {
        return { ok: true, profile: getProfileManager().create(options) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' };
      }
    }
  );

  ipcMain.handle('profiles:delete', (_event, profileId: ProfileId): SwitchProfileResult => {
    try {
      getProfileManager().delete(profileId);
      broadcastUnpushedCount();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' };
    }
  });

  // Doc persistence on the active profile, backing usePersistStore -- Yjs
  // patches in, merged snapshot out. See src/renderer/src/hooks/usePersistStore.ts.
  ipcMain.handle('profiles:load-snapshot', (_event, key: string): Promise<Buffer | null> => {
    return getProfileManager().loadSnapshot(key);
  });

  ipcMain.handle(
    'profiles:append-patch',
    async (_event, key: string, patch: Uint8Array): Promise<void> => {
      await getProfileManager().appendPatch(key, Buffer.from(patch));
      broadcastUnpushedCount();
    }
  );

  // Backs the status bar's sync indicator/popover's initial fetch -- live
  // updates after that arrive via the profiles:unpushed-count-changed push.
  ipcMain.handle('profiles:unpushed-count', (): Promise<number> => {
    return getProfileManager().getUnpushedPatchCount();
  });

  // Backs the status bar popover's "changes available" precheck -- cheap
  // remote status check, no push/pull, called each time the popover opens.
  ipcMain.handle('profiles:status', async (): Promise<SyncStatusResult> => {
    try {
      const status = await getProfileManager().checkRemoteStatus();
      return { ok: true, ...status };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' };
    }
  });

  ipcMain.handle('profiles:sync', async (): Promise<SyncResult> => {
    try {
      const changedKeys = await getProfileManager().sync();
      broadcastDocsChanged(changedKeys);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' };
    } finally {
      // Push()/pull() can mark patches pushed before later failing (e.g. pull
      // errors after a successful push), so the count may have changed even
      // on the error path -- always resync it.
      broadcastUnpushedCount();
    }
  });

  // __DEV__ only, mock-remote profile creation: lets the user either create a
  // fresh sqlite file (a new "mock server") or open an existing one (to
  // simulate a second device joining an already-shared mock server).
  ipcMain.handle(
    'profiles:pick-mock-server-file',
    async (event, mode: 'create' | 'open'): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const defaultPath = join(app.getPath('userData'), 'profiles', 'mock-server.db');

      if (mode === 'create') {
        const options = { defaultPath, filters: MOCK_SERVER_FILE_FILTERS };
        const { canceled, filePath } = win
          ? await dialog.showSaveDialog(win, options)
          : await dialog.showSaveDialog(options);
        return canceled || !filePath ? null : filePath;
      }

      const options = { properties: ['openFile' as const], filters: MOCK_SERVER_FILE_FILTERS };
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return canceled || filePaths.length === 0 ? null : filePaths[0];
    }
  );
}

/** Closes every profile's OfflineStore -- call on app quit. */
export function closeAllProfileSessions(): void {
  manager?.closeAll();
}
