import { create } from 'zustand';
import type {
  Collection,
  CollectionFolder,
  ExportCollectionResult,
  HttpAuth,
  ImportCollectionResult,
  SavedExample,
  SavedRequest
} from '../../../../preload/http-client/types';
import { assertOk } from '../lib/ipcResult';
import { useWorkspacesStore } from './workspaces.store';

interface CollectionsState {
  collections: Collection[];
  isLoaded: boolean;
  load: () => Promise<void>;
  createCollection: (name: string) => Promise<Collection>;
  renameCollection: (collectionId: string, name: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  saveRequest: (
    collectionId: string,
    request: SavedRequest,
    folderId?: string | null
  ) => Promise<void>;
  renameRequest: (collectionId: string, requestId: string, name: string) => Promise<void>;
  deleteRequest: (collectionId: string, requestId: string) => Promise<void>;
  saveExample: (collectionId: string, requestId: string, example: SavedExample) => Promise<void>;
  renameExample: (
    collectionId: string,
    requestId: string,
    exampleId: string,
    name: string
  ) => Promise<void>;
  deleteExample: (collectionId: string, requestId: string, exampleId: string) => Promise<void>;
  createFolder: (
    collectionId: string,
    parentFolderId: string | null,
    name: string
  ) => Promise<void>;
  renameFolder: (collectionId: string, folderId: string, name: string) => Promise<void>;
  deleteFolder: (collectionId: string, folderId: string) => Promise<void>;
  moveRequest: (
    collectionId: string,
    requestId: string,
    targetFolderId: string | null
  ) => Promise<void>;
  moveFolder: (
    collectionId: string,
    folderId: string,
    targetParentFolderId: string | null
  ) => Promise<void>;
  setCollectionAuth: (collectionId: string, auth: HttpAuth) => Promise<void>;
  setFolderAuth: (collectionId: string, folderId: string, auth: HttpAuth) => Promise<void>;
  /** Prompts a save dialog and writes the collection as a Postman v2.1 file. */
  exportCollection: (collectionId: string) => Promise<ExportCollectionResult>;
  /** Prompts an open dialog, parses a Postman v2.0/v2.1 or OpenAPI v3.x file, and adds it as a new collection. */
  importCollection: () => Promise<ImportCollectionResult>;
  /** Same as `importCollection`, but for a file path already known on disk (e.g. dropped onto the sidebar) - skips the open dialog. */
  importCollectionFromPath: (filePath: string) => Promise<ImportCollectionResult>;
}

/**
 * Appends `example` to the given request wherever it lives in the tree, returning a new
 * container only along the path that changed (siblings keep their old reference). Used to patch
 * `saveExample` into state locally instead of round-tripping a fresh `collections:list` -- that
 * read/parses/refilters every collection's full example history (response bodies included) just
 * to pick up the one example that was added.
 */
function addExampleRecursive<T extends { requests: SavedRequest[]; folders: CollectionFolder[] }>(
  container: T,
  requestId: string,
  example: SavedExample
): T {
  if (container.requests.some((r) => r.id === requestId)) {
    return {
      ...container,
      requests: container.requests.map((r) =>
        r.id === requestId ? { ...r, examples: [...(r.examples ?? []), example] } : r
      )
    };
  }
  let changed = false;
  const folders = container.folders.map((f) => {
    const updated = addExampleRecursive(f, requestId, example);
    if (updated !== f) changed = true;
    return updated;
  });
  return changed ? { ...container, folders } : container;
}

// Renderer-side cache of the main-process collections store (which is the
// source of truth, persisted to disk). Every mutation round-trips through
// IPC then refetches - collections data is tiny and local, so simplicity
// wins over optimistic-update bookkeeping. saveExample is the one exception:
// examples carry full response bodies, so a full reload after every save
// is disproportionately expensive -- see addExampleRecursive above.
export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  isLoaded: false,

  load: async () => {
    const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
    const collections = workspaceId ? await window.api.collections.list(workspaceId) : [];
    set({ collections, isLoaded: true });
  },

  createCollection: async (name) => {
    const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
    if (!workspaceId) throw new Error('No active workspace.');
    const collection = await window.api.collections.create({ name, workspaceId });
    await get().load();
    return collection;
  },

  renameCollection: async (collectionId, name) => {
    assertOk(await window.api.collections.rename({ collectionId, name }));
    await get().load();
  },

  deleteCollection: async (collectionId) => {
    assertOk(await window.api.collections.remove({ collectionId }));
    await get().load();
  },

  saveRequest: async (collectionId, request, folderId) => {
    assertOk(await window.api.collections.saveRequest({ collectionId, request, folderId }));
    await get().load();
  },

  renameRequest: async (collectionId, requestId, name) => {
    assertOk(await window.api.collections.renameRequest({ collectionId, requestId, name }));
    await get().load();
  },

  deleteRequest: async (collectionId, requestId) => {
    assertOk(await window.api.collections.deleteRequest({ collectionId, requestId }));
    await get().load();
  },

  saveExample: async (collectionId, requestId, example) => {
    assertOk(await window.api.collections.saveExample({ collectionId, requestId, example }));
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === collectionId ? addExampleRecursive(c, requestId, example) : c
      )
    }));
  },

  renameExample: async (collectionId, requestId, exampleId, name) => {
    assertOk(
      await window.api.collections.renameExample({ collectionId, requestId, exampleId, name })
    );
    await get().load();
  },

  deleteExample: async (collectionId, requestId, exampleId) => {
    assertOk(await window.api.collections.deleteExample({ collectionId, requestId, exampleId }));
    await get().load();
  },

  createFolder: async (collectionId, parentFolderId, name) => {
    assertOk(await window.api.collections.createFolder({ collectionId, parentFolderId, name }));
    await get().load();
  },

  renameFolder: async (collectionId, folderId, name) => {
    assertOk(await window.api.collections.renameFolder({ collectionId, folderId, name }));
    await get().load();
  },

  deleteFolder: async (collectionId, folderId) => {
    assertOk(await window.api.collections.deleteFolder({ collectionId, folderId }));
    await get().load();
  },

  moveRequest: async (collectionId, requestId, targetFolderId) => {
    assertOk(await window.api.collections.moveRequest({ collectionId, requestId, targetFolderId }));
    await get().load();
  },

  moveFolder: async (collectionId, folderId, targetParentFolderId) => {
    assertOk(
      await window.api.collections.moveFolder({ collectionId, folderId, targetParentFolderId })
    );
    await get().load();
  },

  setCollectionAuth: async (collectionId, auth) => {
    assertOk(await window.api.collections.setCollectionAuth({ collectionId, auth }));
    await get().load();
  },

  setFolderAuth: async (collectionId, folderId, auth) => {
    assertOk(await window.api.collections.setFolderAuth({ collectionId, folderId, auth }));
    await get().load();
  },

  exportCollection: async (collectionId) => window.api.collections.exportToFile({ collectionId }),

  importCollection: async () => {
    const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
    if (!workspaceId) return { ok: false, error: 'No active workspace.' };
    const result = await window.api.collections.importFromFile(workspaceId);
    if (result.ok && !result.canceled) await get().load();
    return result;
  },

  importCollectionFromPath: async (filePath) => {
    const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
    if (!workspaceId) return { ok: false, error: 'No active workspace.' };
    const result = await window.api.collections.importFromPath(filePath, workspaceId);
    if (result.ok && !result.canceled) await get().load();
    return result;
  }
}));
