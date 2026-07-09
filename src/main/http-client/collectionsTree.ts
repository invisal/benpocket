import type { Collection, CollectionFolder, SavedRequest } from '../../preload/http-client/types';

/** Anything that can directly hold requests and sub-folders: a Collection root or a CollectionFolder. */
type RequestContainer = Pick<Collection, 'requests' | 'folders'>;

/** Ensures legacy collections (saved before folders existed) have well-formed `requests`/`folders` arrays, recursively. */
export function normalizeCollection(collection: Collection): Collection {
  collection.requests = collection.requests ?? [];
  collection.folders = (collection.folders ?? []).map(normalizeFolder);
  return collection;
}

function normalizeFolder(folder: CollectionFolder): CollectionFolder {
  folder.requests = folder.requests ?? [];
  folder.folders = (folder.folders ?? []).map(normalizeFolder);
  return folder;
}

/** Recursively finds the container (collection root or folder) that directly holds the given request. */
export function findContainerOfRequest(
  container: RequestContainer,
  requestId: string
): RequestContainer | null {
  if (container.requests.some((r) => r.id === requestId)) return container;
  for (const folder of container.folders) {
    const found = findContainerOfRequest(folder, requestId);
    if (found) return found;
  }
  return null;
}

/** Recursively finds a folder by id anywhere under the given container. */
export function findFolder(container: RequestContainer, folderId: string): CollectionFolder | null {
  for (const folder of container.folders) {
    if (folder.id === folderId) return folder;
    const found = findFolder(folder, folderId);
    if (found) return found;
  }
  return null;
}

/** Recursively finds the container (collection root or folder) that directly holds the given folder. */
export function findParentOfFolder(
  container: RequestContainer,
  folderId: string
): RequestContainer | null {
  if (container.folders.some((f) => f.id === folderId)) return container;
  for (const folder of container.folders) {
    const found = findParentOfFolder(folder, folderId);
    if (found) return found;
  }
  return null;
}

/** Resolves a folderId (or null/undefined for the collection root) to its container. */
export function resolveContainer(
  collection: Collection,
  folderId: string | null | undefined
): RequestContainer | null {
  if (!folderId) return collection;
  return findFolder(collection, folderId);
}

/** Removes and returns the request with the given id from wherever it lives in the tree. */
export function removeRequest(collection: Collection, requestId: string): SavedRequest | null {
  const container = findContainerOfRequest(collection, requestId);
  if (!container) return null;
  const index = container.requests.findIndex((r) => r.id === requestId);
  return container.requests.splice(index, 1)[0] ?? null;
}

/** Removes and returns the folder with the given id from wherever it lives in the tree. */
export function removeFolder(collection: Collection, folderId: string): CollectionFolder | null {
  const parent = findParentOfFolder(collection, folderId);
  if (!parent) return null;
  const index = parent.folders.findIndex((f) => f.id === folderId);
  return parent.folders.splice(index, 1)[0] ?? null;
}

/** True if `candidateId` is `folder` itself or nested anywhere underneath it. */
export function isFolderOrDescendant(folder: CollectionFolder, candidateId: string): boolean {
  if (folder.id === candidateId) return true;
  return folder.folders.some((f) => isFolderOrDescendant(f, candidateId));
}

/** Total request count in this container and everything nested under it. */
export function countRequestsRecursive(container: RequestContainer): number {
  return (
    container.requests.length +
    container.folders.reduce((sum, f) => sum + countRequestsRecursive(f), 0)
  );
}
