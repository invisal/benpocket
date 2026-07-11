import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  CreateEnvironmentPayload,
  DeleteEnvironmentPayload,
  Environment,
  RenameEnvironmentPayload,
  SaveEnvironmentVariablesPayload,
  WsAckResult
} from '../../../preload/http-client/types';

function storeFilePath(): string {
  return path.join(app.getPath('userData'), 'postman-environments.json');
}

export async function readEnvironments(): Promise<Environment[]> {
  try {
    const raw = await fs.promises.readFile(storeFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // File doesn't exist yet, or is corrupt - start fresh rather than crash.
    return [];
  }
}

export async function writeEnvironments(environments: Environment[]): Promise<void> {
  const file = storeFilePath();
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(environments, null, 2), 'utf-8');
}

export function registerEnvironmentHandlers(): void {
  ipcMain.handle('environments:list', async (_event, workspaceId: string): Promise<Environment[]> =>
    (await readEnvironments()).filter((e) => e.workspaceId === workspaceId)
  );

  ipcMain.handle(
    'environments:create',
    async (_event, payload: CreateEnvironmentPayload): Promise<Environment> => {
      const environments = await readEnvironments();
      const environment: Environment = {
        id: randomUUID(),
        name: payload.name.trim() || 'Untitled Environment',
        createdAt: Date.now(),
        workspaceId: payload.workspaceId,
        variables: []
      };
      environments.push(environment);
      await writeEnvironments(environments);
      return environment;
    }
  );

  ipcMain.handle(
    'environments:rename',
    async (_event, payload: RenameEnvironmentPayload): Promise<WsAckResult> => {
      const environments = await readEnvironments();
      const target = environments.find((e) => e.id === payload.environmentId);
      if (!target) return { ok: false, error: 'Environment not found.' };
      target.name = payload.name.trim() || target.name;
      await writeEnvironments(environments);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'environments:delete',
    async (_event, payload: DeleteEnvironmentPayload): Promise<WsAckResult> => {
      const environments = await readEnvironments();
      await writeEnvironments(environments.filter((e) => e.id !== payload.environmentId));
      return { ok: true };
    }
  );

  ipcMain.handle(
    'environments:saveVariables',
    async (_event, payload: SaveEnvironmentVariablesPayload): Promise<WsAckResult> => {
      const environments = await readEnvironments();
      const target = environments.find((e) => e.id === payload.environmentId);
      if (!target) return { ok: false, error: 'Environment not found.' };
      target.variables = payload.variables;
      await writeEnvironments(environments);
      return { ok: true };
    }
  );
}
