import { BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';
import type {
  Collection,
  Environment,
  ExportCollectionPayload,
  ExportCollectionResult,
  ImportCollectionResult,
  KeyValuePair
} from '../../../preload/http-client/types';
import { readCollections, writeCollections } from './collections';
import { readEnvironments, writeEnvironments } from './environments';
import {
  exportCollectionFile,
  importCollectionFile,
  importInsomniaV4File,
  importInsomniaV5File,
  importOpenApiFile,
  isInsomniaV4File,
  isInsomniaV5File,
  isLegacyCollectionV1File,
  isCollectionFile,
  isOpenApiFile,
  isSwaggerV2File
} from '../httpClientFormat';
import { sameEnvironmentName, sanitizeFilename } from '../transferUtils';

const SUPPORTED_SCHEMAS_MESSAGE =
  'benpocket supports Postman Collection Format v2.0/v2.1, OpenAPI Description v3.0/v3.1, and Insomnia export format v4/v5 (.json, .yaml, .yml).';

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

/** Writes an imported collection's variables into the environment matching `environmentName` in the same workspace, creating one if none exists yet. Returns the environment id. */
async function upsertImportedVariables(
  workspaceId: string,
  environmentName: string,
  variables: KeyValuePair[]
): Promise<string> {
  const environments = await readEnvironments();
  const existing = environments.find(
    (e) => e.workspaceId === workspaceId && sameEnvironmentName(e.name, environmentName)
  );
  if (existing) {
    existing.variables = mergeVariables(existing.variables, variables);
    await writeEnvironments(environments);
    return existing.id;
  }
  const environment: Environment = {
    id: randomUUID(),
    name: environmentName,
    createdAt: Date.now(),
    workspaceId,
    variables
  };
  environments.push(environment);
  await writeEnvironments(environments);
  return environment.id;
}

/** Persists a freshly-imported collection and, if it brought variables along, writes them into a matching environment named after the collection. Shared by the Postman and OpenAPI import paths, which only ever produce one flat variable set. */
async function finishImport(
  collection: Collection,
  sourceFormat: 'postman' | 'openapi',
  schemaVersion: string,
  variables: KeyValuePair[]
): Promise<ImportCollectionResult> {
  const collections = await readCollections();
  collections.push(collection);
  await writeCollections(collections);

  if (variables.length === 0) {
    return { ok: true, collection, sourceFormat, schemaVersion };
  }
  const environmentId = await upsertImportedVariables(
    collection.workspaceId,
    collection.name,
    variables
  );
  return {
    ok: true,
    collection,
    sourceFormat,
    schemaVersion,
    importedVariableCount: variables.length,
    environmentId
  };
}

/**
 * Persists a freshly-imported Insomnia collection and writes each of its (possibly several -
 * one per switchable sub-environment) environments in, each named individually rather than
 * after the collection. The first one becomes the newly-active environment.
 */
async function finishInsomniaImport(
  collection: Collection,
  schemaVersion: string,
  environments: { name: string; variables: KeyValuePair[] }[]
): Promise<ImportCollectionResult> {
  const collections = await readCollections();
  collections.push(collection);
  await writeCollections(collections);

  if (environments.length === 0) {
    return { ok: true, collection, sourceFormat: 'insomnia', schemaVersion };
  }

  let firstEnvironmentId: string | undefined;
  let totalVariableCount = 0;
  for (const env of environments) {
    const environmentId = await upsertImportedVariables(
      collection.workspaceId,
      env.name,
      env.variables
    );
    firstEnvironmentId ??= environmentId;
    totalVariableCount += env.variables.length;
  }

  return {
    ok: true,
    collection,
    sourceFormat: 'insomnia',
    schemaVersion,
    importedVariableCount: totalVariableCount,
    environmentId: firstEnvironmentId
  };
}

/** Parses a collection/OpenAPI file already on disk and imports it - shared by the open-dialog and drag-and-drop import paths. */
async function importCollectionFromPath(
  filePath: string,
  workspaceId: string
): Promise<ImportCollectionResult> {
  let parsed: unknown;
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = jsYaml.load(raw);
    }
  } catch {
    return {
      ok: false,
      error: `File is not valid JSON or YAML. ${SUPPORTED_SCHEMAS_MESSAGE}`
    };
  }

  if (isLegacyCollectionV1File(parsed)) {
    return {
      ok: false,
      error: `This file looks like a Collection Format v1 export, which isn't supported. Please re-export the collection as v2.1 and try again. ${SUPPORTED_SCHEMAS_MESSAGE}`
    };
  }

  if (isSwaggerV2File(parsed)) {
    return {
      ok: false,
      error: `This file looks like a Swagger / OpenAPI v2.0 document, which isn't supported yet. Please convert it to OpenAPI v3.0/v3.1 and try again. ${SUPPORTED_SCHEMAS_MESSAGE}`
    };
  }

  if (isCollectionFile(parsed)) {
    const { collection, schemaVersion, variables } = importCollectionFile(parsed, workspaceId);
    return finishImport(collection, 'postman', schemaVersion, variables);
  }

  if (isOpenApiFile(parsed)) {
    const { collection, openApiVersion, variables } = importOpenApiFile(parsed, workspaceId);
    return finishImport(collection, 'openapi', openApiVersion, variables);
  }

  if (isInsomniaV4File(parsed)) {
    const { collection, environments } = importInsomniaV4File(parsed, workspaceId);
    return finishInsomniaImport(collection, String(parsed.__export_format ?? 4), environments);
  }

  if (isInsomniaV5File(parsed)) {
    const { collection, environments } = importInsomniaV5File(parsed, workspaceId);
    return finishInsomniaImport(collection, parsed.schema_version ?? '5', environments);
  }

  return {
    ok: false,
    error: `File is not a recognized Collection or OpenAPI export. ${SUPPORTED_SCHEMAS_MESSAGE}`
  };
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
        defaultPath: `${sanitizeFilename(collection.name, 'collection')}.postman_collection.json`,
        filters: [{ name: 'HTTP Client Collection', extensions: ['json'] }]
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
      const collectionFile = exportCollectionFile(collection, matchingEnvironment?.variables);
      await fs.promises.writeFile(
        result.filePath,
        JSON.stringify(collectionFile, null, 2),
        'utf-8'
      );
      return { ok: true, filePath: result.filePath };
    }
  );

  ipcMain.handle(
    'collections:importFromFile',
    async (event, workspaceId: string): Promise<ImportCollectionResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const openOptions = {
        title: 'Import Collection, OpenAPI, or Insomnia Document',
        properties: ['openFile' as const],
        filters: [
          { name: 'Collection / OpenAPI / Insomnia', extensions: ['json', 'yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      };
      const result = win
        ? await dialog.showOpenDialog(win, openOptions)
        : await dialog.showOpenDialog(openOptions);
      if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true };

      return importCollectionFromPath(result.filePaths[0], workspaceId);
    }
  );

  ipcMain.handle(
    'collections:importFromPath',
    (_event, filePath: string, workspaceId: string): Promise<ImportCollectionResult> =>
      importCollectionFromPath(filePath, workspaceId)
  );
}
