import { createContext, useContext } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { type FileEntry } from '../../file-explorer/components/columns';

interface WorkspaceState {
  rootPath: string;

  /** Cache of fetched directory listings, keyed by path/URI. `undefined` = not fetched yet. */
  childrenByPath: Record<string, FileEntry[] | undefined>;
  expanded: Set<string>;

  /** Path currently loaded into the preview/edit buffer -- also drives the tree's active-row highlight. */
  previewFile: string | null;
  /** True when the preview's edit buffer differs from what's on disk. */
  isDirty: boolean;

  /** Bumped by the refresh button so the tree data hook re-fetches root + every expanded path. */
  refreshSignal: number;

  setChildren: (path: string, children: FileEntry[]) => void;
  setExpanded: (expanded: Set<string>) => void;
  setPreviewFile: (path: string | null) => void;
  setDirty: (isDirty: boolean) => void;
  refresh: () => void;
}

export type WorkspaceStore = UseBoundStore<StoreApi<WorkspaceState>>;

/**
 * Each Workspace tab gets its own store instance (created via this factory, one
 * per mounted `WorkspaceMain`) rather than a single module-level store --
 * otherwise every open Workspace tab would share the same tree/preview state.
 */
export function createWorkspaceStore(rootPath: string): WorkspaceStore {
  return create<WorkspaceState>((set, get) => ({
    rootPath,
    childrenByPath: {},
    expanded: new Set([rootPath]),

    previewFile: null,
    isDirty: false,

    refreshSignal: 0,

    setChildren: (path, children) =>
      set({ childrenByPath: { ...get().childrenByPath, [path]: children } }),
    setExpanded: (expanded) => set({ expanded }),
    setPreviewFile: (previewFile) => set({ previewFile }),
    setDirty: (isDirty) => set({ isDirty }),
    refresh: () => {
      // Clear the cache for every path currently loaded so the tree data hook
      // treats them as unfetched again and re-requests them.
      const cleared = Object.fromEntries(
        Object.keys(get().childrenByPath).map((path) => [path, undefined])
      );
      set((prev) => ({
        childrenByPath: cleared,
        refreshSignal: prev.refreshSignal + 1
      }));
    }
  }));
}

export const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

export function useWorkspaceStore<T>(selector: (state: WorkspaceState) => T): T {
  const useStore = useContext(WorkspaceStoreContext);
  if (!useStore) {
    throw new Error('useWorkspaceStore must be used within a WorkspaceStoreContext.Provider');
  }
  return useStore(selector);
}
