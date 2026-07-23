import { BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import type {
  Environment,
  ImportEnvironmentResult,
  ResolveEnvironmentImportPayload
} from '../../../preload/http-client/types';
import { readEnvironments, writeEnvironments } from './environments';
import { importPostmanEnvironment, isPostmanEnvironmentFile } from '../httpClientFormat';

function sameEnvironmentName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** "login" -> "login (copy)" -> "login (copy 2)" -> ..., skipping whatever name is already taken. */
function generateCopyName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  let candidate = `${baseName} (copy)`;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${baseName} (copy ${suffix})`;
    suffix += 1;
  }
  return candidate;
}

export function registerEnvironmentTransferHandlers(): void {
  ipcMain.handle(
    'environments:importFromFile',
    async (event, workspaceId: string): Promise<ImportEnvironmentResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const openOptions = {
        title: 'Import Postman Environment',
        properties: ['openFile' as const],
        filters: [{ name: 'Postman Environment', extensions: ['json'] }]
      };
      const result = win
        ? await dialog.showOpenDialog(win, openOptions)
        : await dialog.showOpenDialog(openOptions);
      if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true };

      let parsed: unknown;
      try {
        const raw = await fs.promises.readFile(result.filePaths[0], 'utf-8');
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: 'File is not valid JSON.' };
      }

      if (!isPostmanEnvironmentFile(parsed)) {
        return {
          ok: false,
          error: 'File is not a recognized Postman Environment export (.postman_environment.json).'
        };
      }

      const draft = importPostmanEnvironment(parsed);
      const environments = await readEnvironments();
      const existing = environments.find(
        (e) => e.workspaceId === workspaceId && sameEnvironmentName(e.name, draft.name)
      );
      if (existing) {
        return {
          ok: true,
          conflict: { existingId: existing.id, existingName: existing.name, draft }
        };
      }

      const environment: Environment = {
        id: randomUUID(),
        name: draft.name,
        createdAt: Date.now(),
        workspaceId,
        variables: draft.variables
      };
      environments.push(environment);
      await writeEnvironments(environments);
      return { ok: true, environment };
    }
  );

  ipcMain.handle(
    'environments:resolveImportConflict',
    async (_event, payload: ResolveEnvironmentImportPayload): Promise<ImportEnvironmentResult> => {
      const environments = await readEnvironments();

      if (payload.choice === 'replace') {
        const target = environments.find((e) => e.id === payload.existingId);
        if (!target) return { ok: false, error: 'Environment not found.' };
        target.variables = payload.draft.variables;
        await writeEnvironments(environments);
        return { ok: true, environment: target };
      }

      const existingNames = environments
        .filter((e) => e.workspaceId === payload.workspaceId)
        .map((e) => e.name);
      const environment: Environment = {
        id: randomUUID(),
        name: generateCopyName(payload.draft.name, existingNames),
        createdAt: Date.now(),
        workspaceId: payload.workspaceId,
        variables: payload.draft.variables
      };
      environments.push(environment);
      await writeEnvironments(environments);
      return { ok: true, environment };
    }
  );
}
