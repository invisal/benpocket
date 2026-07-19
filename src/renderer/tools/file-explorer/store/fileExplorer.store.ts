import { createContext, useContext } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { type FileEntry } from '../components/columns';

export type PanelMode = 'explorer' | 'preview';
export type PanelIndex = 0 | 1;
export type ActivePanelId = 'panel1' | 'panel2';
export type FileClipboard = { paths: string[]; mode: 'copy' | 'cut' } | null;

/** A predicted change to a directory listing, applied immediately under 'optimistic' sync. */
export type EntriesPatch =
  { type: 'remove'; paths: string[] } | { type: 'insert'; entry: FileEntry };

export interface FileExplorerPanelState {
  path: string | null;
  selection: FileEntry[];
  mode: PanelMode;
  /** Path currently loaded into the preview/edit buffer while `mode === 'preview'`. */
  previewFile: string | null;
  /** True when the preview's edit buffer differs from what's on disk. */
  isDirty: boolean;
}

function createInitialPanelState(): FileExplorerPanelState {
  return {
    path: null,
    selection: [],
    mode: 'explorer',
    previewFile: null,
    isDirty: false
  };
}

interface FileExplorerState {
  panels: [FileExplorerPanelState, FileExplorerPanelState];
  activePanel: ActivePanelId;

  sidebarWidth: number;
  /** Percentage (0-100) of the panel1/panel2 content area, so the split stays proportional on window resize. */
  panel1Width: number;

  /** Shared across both panels so a copy/cut in one panel can be pasted in the other. */
  clipboard: FileClipboard;
  /** Bumped after any operation that mutates the filesystem (copy/move/delete/paste/save) so both panels refetch their listing. */
  refreshSignal: number;

  setPanelPath: (index: PanelIndex, path: string) => void;
  setPanelSelection: (index: PanelIndex, selection: FileEntry[]) => void;
  setPanelMode: (index: PanelIndex, mode: PanelMode) => void;
  setPanelPreviewFile: (index: PanelIndex, previewFile: string | null) => void;
  setPanelDirty: (index: PanelIndex, isDirty: boolean) => void;
  setActivePanel: (panel: ActivePanelId) => void;
  setSidebarWidth: (width: number) => void;
  setPanel1Width: (width: number) => void;
  setClipboard: (clipboard: FileClipboard) => void;
  bumpRefresh: () => void;
}

export type FileExplorerStore = UseBoundStore<StoreApi<FileExplorerState>>;

function updatePanel(
  panels: [FileExplorerPanelState, FileExplorerPanelState],
  index: PanelIndex,
  patch: Partial<FileExplorerPanelState>
): [FileExplorerPanelState, FileExplorerPanelState] {
  const next: [FileExplorerPanelState, FileExplorerPanelState] = [...panels];
  next[index] = { ...next[index], ...patch };
  return next;
}

/**
 * Each File Explorer tab gets its own store instance (created via this factory,
 * one per mounted `FileExplorerMain`) rather than a single module-level store --
 * otherwise every open File Explorer tab would share the same panel paths/selection.
 */
export function createFileExplorerStore(): FileExplorerStore {
  return create<FileExplorerState>((set, get) => ({
    panels: [createInitialPanelState(), createInitialPanelState()],
    activePanel: 'panel1',

    sidebarWidth: 200,
    panel1Width: 50,

    clipboard: null,
    refreshSignal: 0,

    setPanelPath: (index, path) => set({ panels: updatePanel(get().panels, index, { path }) }),
    setPanelSelection: (index, selection) =>
      set({ panels: updatePanel(get().panels, index, { selection }) }),
    setPanelMode: (index, mode) => set({ panels: updatePanel(get().panels, index, { mode }) }),
    setPanelPreviewFile: (index, previewFile) =>
      set({ panels: updatePanel(get().panels, index, { previewFile }) }),
    setPanelDirty: (index, isDirty) =>
      set({ panels: updatePanel(get().panels, index, { isDirty }) }),
    setActivePanel: (panel) => set({ activePanel: panel }),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    setPanel1Width: (width) => set({ panel1Width: width }),
    setClipboard: (clipboard) => set({ clipboard }),
    bumpRefresh: () => set({ refreshSignal: get().refreshSignal + 1 })
  }));
}

export const FileExplorerStoreContext = createContext<FileExplorerStore | null>(null);

export function useFileExplorerStore<T>(selector: (state: FileExplorerState) => T): T {
  const useStore = useContext(FileExplorerStoreContext);
  if (!useStore) {
    throw new Error('useFileExplorerStore must be used within a FileExplorerStoreContext.Provider');
  }
  return useStore(selector);
}
