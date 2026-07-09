import type { CollectionFolder, SavedRequest } from '../../../../preload/http-client/types';

interface RequestContainer {
  requests: SavedRequest[];
  folders: CollectionFolder[];
}

export function countRequestsRecursive(container: RequestContainer): number {
  return (
    container.requests.length +
    container.folders.reduce((sum, f) => sum + countRequestsRecursive(f), 0)
  );
}

export function isFolderOrDescendant(folder: CollectionFolder, id: string): boolean {
  if (folder.id === id) return true;
  return folder.folders.some((f) => isFolderOrDescendant(f, id));
}

/** Collects every folder id in this container's tree, at every depth. */
export function collectAllFolderIds(container: RequestContainer): string[] {
  return container.folders.flatMap((f) => [f.id, ...collectAllFolderIds(f)]);
}

export function findFolderById(
  folders: CollectionFolder[],
  id: string
): CollectionFolder | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolderById(folder.folders, id);
    if (found) return found;
  }
  return undefined;
}

export function findRequestInContainer(
  container: RequestContainer,
  requestId: string
): SavedRequest | undefined {
  const direct = container.requests.find((r) => r.id === requestId);
  if (direct) return direct;
  for (const folder of container.folders) {
    const found = findRequestInContainer(folder, requestId);
    if (found) return found;
  }
  return undefined;
}

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

/** Flattens a folder tree into an indented list for a "target folder" picker, skipping `excludeId` and its descendants. */
export function flattenFolderOptions(
  folders: CollectionFolder[],
  depth = 0,
  excludeId?: string
): FolderOption[] {
  const result: FolderOption[] = [];
  for (const folder of folders) {
    if (excludeId && isFolderOrDescendant(folder, excludeId)) continue;
    result.push({ id: folder.id, name: folder.name, depth });
    result.push(...flattenFolderOptions(folder.folders, depth + 1, excludeId));
  }
  return result;
}
