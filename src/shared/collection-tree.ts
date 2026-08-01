// Pure tree-walking helpers shared between the http-client main-process store
// (src/main/http-client/collectionsTree.ts) and the renderer (src/renderer/tools/http-client/lib/collectionTree.ts),
// which both operate on the same Collection/CollectionFolder shape from src/preload/http-client/types.

interface FolderLike {
  id: string;
  requests: unknown[];
  folders: FolderLike[];
}

interface ContainerLike {
  requests: unknown[];
  folders: FolderLike[];
}

/** True if `candidateId` is `folder` itself or nested anywhere underneath it. */
export function isFolderOrDescendant(folder: FolderLike, candidateId: string): boolean {
  if (folder.id === candidateId) return true;
  return folder.folders.some((f) => isFolderOrDescendant(f, candidateId));
}

/** Total request count in this container and everything nested under it. */
export function countRequestsRecursive(container: ContainerLike): number {
  return (
    container.requests.length +
    container.folders.reduce((sum, f) => sum + countRequestsRecursive(f), 0)
  );
}
