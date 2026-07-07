import { create } from 'zustand';
import type {
  Collection,
  ExportCollectionResult,
  ImportCollectionResult,
  SavedRequest
} from '../../../../preload/postman/types';

interface CollectionsState {
  collections: Collection[];
  isLoaded: boolean;
  load: () => Promise<void>;
  createCollection: (name: string) => Promise<Collection>;
  renameCollection: (collectionId: string, name: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  saveRequest: (collectionId: string, request: SavedRequest, folderId?: string | null) => Promise<void>;
  renameRequest: (collectionId: string, requestId: string, name: string) => Promise<void>;
  deleteRequest: (collectionId: string, requestId: string) => Promise<void>;
  createFolder: (collectionId: string, parentFolderId: string | null, name: string) => Promise<void>;
  renameFolder: (collectionId: string, folderId: string, name: string) => Promise<void>;
  deleteFolder: (collectionId: string, folderId: string) => Promise<void>;
  moveRequest: (collectionId: string, requestId: string, targetFolderId: string | null) => Promise<void>;
  moveFolder: (collectionId: string, folderId: string, targetParentFolderId: string | null) => Promise<void>;
  /** Prompts a save dialog and writes the collection as a Postman v2.1 file. */
  exportCollection: (collectionId: string) => Promise<ExportCollectionResult>;
  /** Prompts an open dialog, parses a Postman v2.0 or v2.1 collection file, and adds it as a new collection. */
  importCollection: () => Promise<ImportCollectionResult>;
}

// Renderer-side cache of the main-process collections store (which is the
// source of truth, persisted to disk). Every mutation round-trips through
// IPC then refetches - collections data is tiny and local, so simplicity
// wins over optimistic-update bookkeeping.
export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  isLoaded: false,

  load: async () => {
    const collections = await window.api.collections.list();
    set({ collections, isLoaded: true });
  },

  createCollection: async (name) => {
    const collection = await window.api.collections.create(name);
    await get().load();
    return collection;
  },

  renameCollection: async (collectionId, name) => {
    await window.api.collections.rename({ collectionId, name });
    await get().load();
  },

  deleteCollection: async (collectionId) => {
    await window.api.collections.remove({ collectionId });
    await get().load();
  },

  saveRequest: async (collectionId, request, folderId) => {
    await window.api.collections.saveRequest({ collectionId, request, folderId });
    await get().load();
  },

  renameRequest: async (collectionId, requestId, name) => {
    await window.api.collections.renameRequest({ collectionId, requestId, name });
    await get().load();
  },

  deleteRequest: async (collectionId, requestId) => {
    await window.api.collections.deleteRequest({ collectionId, requestId });
    await get().load();
  },

  createFolder: async (collectionId, parentFolderId, name) => {
    await window.api.collections.createFolder({ collectionId, parentFolderId, name });
    await get().load();
  },

  renameFolder: async (collectionId, folderId, name) => {
    await window.api.collections.renameFolder({ collectionId, folderId, name });
    await get().load();
  },

  deleteFolder: async (collectionId, folderId) => {
    await window.api.collections.deleteFolder({ collectionId, folderId });
    await get().load();
  },

  moveRequest: async (collectionId, requestId, targetFolderId) => {
    await window.api.collections.moveRequest({ collectionId, requestId, targetFolderId });
    await get().load();
  },

  moveFolder: async (collectionId, folderId, targetParentFolderId) => {
    await window.api.collections.moveFolder({ collectionId, folderId, targetParentFolderId });
    await get().load();
  },

  exportCollection: async (collectionId) => window.api.collections.exportToFile({ collectionId }),

  importCollection: async () => {
    const result = await window.api.collections.importFromFile();
    if (result.ok && !result.canceled) await get().load();
    return result;
  }
}));
