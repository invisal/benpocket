import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  DeleteWorkspacePayload,
  RenameWorkspacePayload,
  Workspace,
  WsAckResult
} from '../../../preload/http-client/types';
import { readCollections, writeCollections } from './collections';
import { readEnvironments, writeEnvironments } from './environments';

function storeFilePath(): string {
  return path.join(app.getPath('userData'), 'postman-workspaces.json');
}

async function readWorkspaces(): Promise<Workspace[]> {
  try {
    const raw = await fs.promises.readFile(storeFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // File doesn't exist yet, or is corrupt - start fresh rather than crash.
    return [];
  }
}

async function writeWorkspaces(workspaces: Workspace[]): Promise<void> {
  const file = storeFilePath();
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(workspaces, null, 2), 'utf-8');
}

/** Ensures at least one workspace exists, creating a default "Personal" one on first run. */
export async function getOrCreateDefaultWorkspace(): Promise<Workspace> {
  const workspaces = await readWorkspaces();
  if (workspaces.length > 0) {
    return workspaces.reduce((oldest, w) => (w.createdAt < oldest.createdAt ? w : oldest));
  }
  const workspace: Workspace = { id: randomUUID(), name: 'Personal', createdAt: Date.now() };
  await writeWorkspaces([workspace]);
  return workspace;
}

/**
 * One-time (idempotent) startup migration: stamps any collection/environment saved
 * before workspaces existed with the default workspace's id, so pre-existing user data
 * isn't orphaned once collections/environments become workspace-scoped.
 */
export async function migrateWorkspaceData(): Promise<void> {
  const [collections, environments] = await Promise.all([readCollections(), readEnvironments()]);
  const needsMigration =
    collections.some((c) => !c.workspaceId) || environments.some((e) => !e.workspaceId);
  if (!needsMigration) return;

  const defaultWorkspace = await getOrCreateDefaultWorkspace();

  if (collections.some((c) => !c.workspaceId)) {
    await writeCollections(
      collections.map((c) => (c.workspaceId ? c : { ...c, workspaceId: defaultWorkspace.id }))
    );
  }
  if (environments.some((e) => !e.workspaceId)) {
    await writeEnvironments(
      environments.map((e) => (e.workspaceId ? e : { ...e, workspaceId: defaultWorkspace.id }))
    );
  }
}

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspaces:list', async (): Promise<Workspace[]> => {
    // Runs the migration on every list call rather than only at app startup, so it's
    // tied to the same request the renderer already awaits before loading
    // collections/environments - no separate startup-ordering race to worry about.
    await migrateWorkspaceData();
    return readWorkspaces();
  });

  ipcMain.handle('workspaces:create', async (_event, name: string): Promise<Workspace> => {
    const workspaces = await readWorkspaces();
    const workspace: Workspace = {
      id: randomUUID(),
      name: name.trim() || 'Untitled Workspace',
      createdAt: Date.now()
    };
    workspaces.push(workspace);
    await writeWorkspaces(workspaces);
    return workspace;
  });

  ipcMain.handle(
    'workspaces:rename',
    async (_event, payload: RenameWorkspacePayload): Promise<WsAckResult> => {
      const workspaces = await readWorkspaces();
      const target = workspaces.find((w) => w.id === payload.workspaceId);
      if (!target) return { ok: false, error: 'Workspace not found.' };
      target.name = payload.name.trim() || target.name;
      await writeWorkspaces(workspaces);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'workspaces:delete',
    async (_event, payload: DeleteWorkspacePayload): Promise<WsAckResult> => {
      const workspaces = await readWorkspaces();
      if (workspaces.length <= 1) {
        return { ok: false, error: 'Cannot delete the last workspace.' };
      }
      await writeWorkspaces(workspaces.filter((w) => w.id !== payload.workspaceId));

      const collections = await readCollections();
      await writeCollections(collections.filter((c) => c.workspaceId !== payload.workspaceId));

      const environments = await readEnvironments();
      await writeEnvironments(environments.filter((e) => e.workspaceId !== payload.workspaceId));

      return { ok: true };
    }
  );
}
