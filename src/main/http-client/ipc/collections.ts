import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Collection,
  CreateCollectionPayload,
  CreateFolderPayload,
  DeleteCollectionPayload,
  DeleteFolderPayload,
  DeleteRequestPayload,
  MoveFolderPayload,
  MoveRequestPayload,
  RenameCollectionPayload,
  RenameFolderPayload,
  RenameRequestPayload,
  SaveRequestPayload,
  WsAckResult
} from '../../../preload/http-client/types';
import {
  findContainerOfRequest,
  findFolder,
  isFolderOrDescendant,
  normalizeCollection,
  removeFolder,
  removeRequest,
  resolveContainer
} from '../collectionsTree';

function storeFilePath(): string {
  return path.join(app.getPath('userData'), 'postman-collections.json');
}

export async function readCollections(): Promise<Collection[]> {
  try {
    const raw = await fs.promises.readFile(storeFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeCollection) : [];
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
  ipcMain.handle('collections:list', async (_event, workspaceId: string): Promise<Collection[]> =>
    (await readCollections()).filter((c) => c.workspaceId === workspaceId)
  );

  ipcMain.handle(
    'collections:create',
    async (_event, payload: CreateCollectionPayload): Promise<Collection> => {
      const collections = await readCollections();
      const collection: Collection = {
        id: randomUUID(),
        name: payload.name.trim() || 'Untitled Collection',
        createdAt: Date.now(),
        workspaceId: payload.workspaceId,
        requests: [],
        folders: []
      };
      collections.push(collection);
      await writeCollections(collections);
      return collection;
    }
  );

  ipcMain.handle(
    'collections:rename',
    async (_event, payload: RenameCollectionPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      target.name = payload.name.trim() || target.name;
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:delete',
    async (_event, payload: DeleteCollectionPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      await writeCollections(collections.filter((c) => c.id !== payload.collectionId));
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:saveRequest',
    async (_event, payload: SaveRequestPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };

      const existingContainer = findContainerOfRequest(target, payload.request.id);
      if (existingContainer) {
        const index = existingContainer.requests.findIndex((r) => r.id === payload.request.id);
        existingContainer.requests[index] = payload.request;
      } else {
        const destination = resolveContainer(target, payload.folderId);
        if (!destination) return { ok: false, error: 'Target folder not found.' };
        destination.requests.push(payload.request);
      }

      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:renameRequest',
    async (_event, payload: RenameRequestPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const container = findContainerOfRequest(target, payload.requestId);
      const request = container?.requests.find((r) => r.id === payload.requestId);
      if (!request) return { ok: false, error: 'Request not found.' };
      request.name = payload.name.trim() || request.name;
      request.updatedAt = Date.now();
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:deleteRequest',
    async (_event, payload: DeleteRequestPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      removeRequest(target, payload.requestId);
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:createFolder',
    async (_event, payload: CreateFolderPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const parent = resolveContainer(target, payload.parentFolderId);
      if (!parent) return { ok: false, error: 'Parent folder not found.' };
      parent.folders.push({
        id: randomUUID(),
        name: payload.name.trim() || 'New Folder',
        folders: [],
        requests: []
      });
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:renameFolder',
    async (_event, payload: RenameFolderPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const folder = findFolder(target, payload.folderId);
      if (!folder) return { ok: false, error: 'Folder not found.' };
      folder.name = payload.name.trim() || folder.name;
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:deleteFolder',
    async (_event, payload: DeleteFolderPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const removed = removeFolder(target, payload.folderId);
      if (!removed) return { ok: false, error: 'Folder not found.' };
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:moveRequest',
    async (_event, payload: MoveRequestPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const destination = resolveContainer(target, payload.targetFolderId);
      if (!destination) return { ok: false, error: 'Target folder not found.' };
      const request = removeRequest(target, payload.requestId);
      if (!request) return { ok: false, error: 'Request not found.' };
      destination.requests.push(request);
      await writeCollections(collections);
      return { ok: true };
    }
  );

  ipcMain.handle(
    'collections:moveFolder',
    async (_event, payload: MoveFolderPayload): Promise<WsAckResult> => {
      const collections = await readCollections();
      const target = collections.find((c) => c.id === payload.collectionId);
      if (!target) return { ok: false, error: 'Collection not found.' };
      const folder = findFolder(target, payload.folderId);
      if (!folder) return { ok: false, error: 'Folder not found.' };
      if (
        payload.targetParentFolderId &&
        isFolderOrDescendant(folder, payload.targetParentFolderId)
      ) {
        return {
          ok: false,
          error: "Can't move a folder into itself or one of its own subfolders."
        };
      }
      const destination = resolveContainer(target, payload.targetParentFolderId);
      if (!destination) return { ok: false, error: 'Target folder not found.' };
      removeFolder(target, payload.folderId);
      destination.folders.push(folder);
      await writeCollections(collections);
      return { ok: true };
    }
  );
}
