import { BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import type {
  Environment,
  ExportCollectionPayload,
  ExportCollectionResult,
  ImportCollectionResult,
  KeyValuePair
} from '../../../preload/http-client/types';
import { readCollections, writeCollections } from './collections';
import { readEnvironments, writeEnvironments } from './environments';
import {
  exportCollectionToPostman,
  importPostmanCollection,
  isLegacyPostmanV1Collection,
  isPostmanCollectionFile
} from '../httpClientFormat';

const SUPPORTED_SCHEMAS_MESSAGE =
  'benpocket supports Postman Collection Format v2.0 and v2.1 (.json exports from Postman).';

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'collection';
}

/** Case-insensitive, trimmed match — good enough to pair a collection with "its" environment by name. */
function sameEnvironmentName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Adds/updates `incoming` variables into `existing` by key, preserving any variables `existing` already has that aren't in `incoming`. */
function mergeVariables(existing: KeyValuePair[], incoming: KeyValuePair[]): KeyValuePair[] {
  const merged = [...existing];
  for (const variable of incoming) {
    const index = merged.findIndex((v) => v.key === variable.key);
    if (index === -1) merged.push(variable);
    else merged[index] = { ...merged[index], value: variable.value, enabled: variable.enabled };
  }
  return merged;
}

/** Writes an imported Postman collection's variables into the environment matching its name in the same workspace, creating one if none exists yet. Returns the environment id. */
async function upsertImportedVariables(
  workspaceId: string,
  collectionName: string,
  variables: KeyValuePair[]
): Promise<string> {
  const environments = await readEnvironments();
  const existing = environments.find(
    (e) => e.workspaceId === workspaceId && sameEnvironmentName(e.name, collectionName)
  );
  if (existing) {
    existing.variables = mergeVariables(existing.variables, variables);
    await writeEnvironments(environments);
    return existing.id;
  }
  const environment: Environment = {
    id: randomUUID(),
    name: collectionName,
    createdAt: Date.now(),
    workspaceId,
    variables
  };
  environments.push(environment);
  await writeEnvironments(environments);
  return environment.id;
}

export function registerCollectionTransferHandlers(): void {
  ipcMain.handle(
    'collections:exportToFile',
    async (event, payload: ExportCollectionPayload): Promise<ExportCollectionResult> => {
      const collections = await readCollections();
      const collection = collections.find((c) => c.id === payload.collectionId);
      if (!collection) return { ok: false, error: 'Collection not found.' };

      const win = BrowserWindow.fromWebContents(event.sender);
      const saveOptions = {
        title: 'Export Collection',
        defaultPath: `${sanitizeFilename(collection.name)}.postman_collection.json`,
        filters: [{ name: 'Postman Collection', extensions: ['json'] }]
      };
      const result = win
        ? await dialog.showSaveDialog(win, saveOptions)
        : await dialog.showSaveDialog(saveOptions);
      if (result.canceled || !result.filePath) return { ok: true, canceled: true };

      const environments = await readEnvironments();
      const matchingEnvironment = environments.find(
        (e) =>
          e.workspaceId === collection.workspaceId && sameEnvironmentName(e.name, collection.name)
      );
      const postmanFile = exportCollectionToPostman(collection, matchingEnvironment?.variables);
      await fs.promises.writeFile(result.filePath, JSON.stringify(postmanFile, null, 2), 'utf-8');
      return { ok: true, filePath: result.filePath };
    }
  );

  ipcMain.handle(
    'collections:importFromFile',
    async (event, workspaceId: string): Promise<ImportCollectionResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const openOptions = {
        title: 'Import Postman Collection (v2.0 / v2.1)',
        properties: ['openFile' as const],
        filters: [{ name: 'Postman Collection (v2.0 / v2.1)', extensions: ['json'] }]
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
        return { ok: false, error: `File is not valid JSON. ${SUPPORTED_SCHEMAS_MESSAGE}` };
      }

      if (isLegacyPostmanV1Collection(parsed)) {
        return {
          ok: false,
          error: `This file looks like a Postman Collection Format v1 export, which isn't supported. Please re-export the collection from Postman as v2.1 and try again. ${SUPPORTED_SCHEMAS_MESSAGE}`
        };
      }

      if (!isPostmanCollectionFile(parsed)) {
        return {
          ok: false,
          error: `File is not a recognized Postman Collection export. ${SUPPORTED_SCHEMAS_MESSAGE}`
        };
      }

      const { collection, schemaVersion, variables } = importPostmanCollection(parsed, workspaceId);
      const collections = await readCollections();
      collections.push(collection);
      await writeCollections(collections);

      if (variables.length === 0) {
        return { ok: true, collection, schemaVersion };
      }
      const environmentId = await upsertImportedVariables(workspaceId, collection.name, variables);
      return {
        ok: true,
        collection,
        schemaVersion,
        importedVariableCount: variables.length,
        environmentId
      };
    }
  );
}
