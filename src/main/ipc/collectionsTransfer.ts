import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import type { ExportCollectionPayload, ExportCollectionResult, ImportCollectionResult } from '../../preload/postman.types';
import { readCollections, writeCollections } from './collections';
import { exportCollectionToPostman, importPostmanCollection, isPostmanCollectionFile } from '../postmanFormat';

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'collection';
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
      const result = win ? await dialog.showSaveDialog(win, saveOptions) : await dialog.showSaveDialog(saveOptions);
      if (result.canceled || !result.filePath) return { ok: true, canceled: true };

      const postmanFile = exportCollectionToPostman(collection);
      await fs.promises.writeFile(result.filePath, JSON.stringify(postmanFile, null, 2), 'utf-8');
      return { ok: true, filePath: result.filePath };
    }
  );

  ipcMain.handle('collections:importFromFile', async (event): Promise<ImportCollectionResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const openOptions = {
      title: 'Import Collection',
      properties: ['openFile' as const],
      filters: [{ name: 'Postman Collection', extensions: ['json'] }]
    };
    const result = win ? await dialog.showOpenDialog(win, openOptions) : await dialog.showOpenDialog(openOptions);
    if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true };

    let parsed: unknown;
    try {
      const raw = await fs.promises.readFile(result.filePaths[0], 'utf-8');
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'File is not valid JSON.' };
    }

    if (!isPostmanCollectionFile(parsed)) {
      return { ok: false, error: 'File is not a recognized Postman Collection (v2.1) export.' };
    }

    const collection = importPostmanCollection(parsed);
    const collections = await readCollections();
    collections.push(collection);
    await writeCollections(collections);
    return { ok: true, collection };
  });
}
