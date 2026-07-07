import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Collection,
  DeleteCollectionPayload,
  DeleteRequestPayload,
  RenameCollectionPayload,
  RenameRequestPayload,
  SaveRequestPayload,
  WsAckResult
} from '../../preload/postman.types';

function storeFilePath(): string {
  return path.join(app.getPath('userData'), 'postman-collections.json');
}

export async function readCollections(): Promise<Collection[]> {
  try {
    const raw = await fs.promises.readFile(storeFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // File doesn't exist yet, or is corrupt - start fresh rather than crash.
    return [];
  }
}

export async function writeCollections(collections: Collection[]): Promise<void> {
  const file = storeFilePath();
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(collections, null, 2), 'utf-8');
}

export function registerCollectionHandlers(): void {
  ipcMain.handle('collections:list', async (): Promise<Collection[]> => readCollections());

  ipcMain.handle('collections:create', async (_event, name: string): Promise<Collection> => {
    const collections = await readCollections();
    const collection: Collection = {
      id: randomUUID(),
      name: name.trim() || 'Untitled Collection',
      createdAt: Date.now(),
      requests: []
    };
    collections.push(collection);
    await writeCollections(collections);
    return collection;
  });

  ipcMain.handle('collections:rename', async (_event, payload: RenameCollectionPayload): Promise<WsAckResult> => {
    const collections = await readCollections();
    const target = collections.find((c) => c.id === payload.collectionId);
    if (!target) return { ok: false, error: 'Collection not found.' };
    target.name = payload.name.trim() || target.name;
    await writeCollections(collections);
    return { ok: true };
  });

  ipcMain.handle('collections:delete', async (_event, payload: DeleteCollectionPayload): Promise<WsAckResult> => {
    const collections = await readCollections();
    await writeCollections(collections.filter((c) => c.id !== payload.collectionId));
    return { ok: true };
  });

  ipcMain.handle('collections:saveRequest', async (_event, payload: SaveRequestPayload): Promise<WsAckResult> => {
    const collections = await readCollections();
    const target = collections.find((c) => c.id === payload.collectionId);
    if (!target) return { ok: false, error: 'Collection not found.' };
    const index = target.requests.findIndex((r) => r.id === payload.request.id);
    if (index >= 0) {
      target.requests[index] = payload.request;
    } else {
      target.requests.push(payload.request);
    }
    await writeCollections(collections);
    return { ok: true };
  });

  ipcMain.handle('collections:renameRequest', async (_event, payload: RenameRequestPayload): Promise<WsAckResult> => {
    const collections = await readCollections();
    const target = collections.find((c) => c.id === payload.collectionId);
    const request = target?.requests.find((r) => r.id === payload.requestId);
    if (!request) return { ok: false, error: 'Request not found.' };
    request.name = payload.name.trim() || request.name;
    request.updatedAt = Date.now();
    await writeCollections(collections);
    return { ok: true };
  });

  ipcMain.handle('collections:deleteRequest', async (_event, payload: DeleteRequestPayload): Promise<WsAckResult> => {
    const collections = await readCollections();
    const target = collections.find((c) => c.id === payload.collectionId);
    if (!target) return { ok: false, error: 'Collection not found.' };
    target.requests = target.requests.filter((r) => r.id !== payload.requestId);
    await writeCollections(collections);
    return { ok: true };
  });
}
