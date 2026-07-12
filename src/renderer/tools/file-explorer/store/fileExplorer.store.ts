import { createContext, useContext } from 'react';
import { create, StoreApi, UseBoundStore } from 'zustand';
import { FileEntry } from '../components/columns';

export type Panel2Mode = 'table' | 'preview';
export type ActivePanelId = 'panel1' | 'panel2';
export type FileClipboard = { paths: string[]; mode: 'copy' | 'cut' } | null;

interface FileExplorerState {
  panel1Path: string | null;
  panel2Path: string | null;
  panel2Mode: Panel2Mode;
  activePanel: ActivePanelId;
  panel1Selection: FileEntry[];

  sidebarWidth: number;
  /** Percentage (0-100) of the panel1/panel2 content area, so the split stays proportional on window resize. */
  panel1Width: number;

  /** Shared across both panels so a copy/cut in one panel can be pasted in the other. */
  clipboard: FileClipboard;
  /** Bumped after any operation that mutates the filesystem (copy/move/delete/paste) so both panels refetch their listing. */
  refreshSignal: number;

  setPanel1Path: (path: string) => void;
  setPanel2Path: (path: string) => void;
  setPanel2Mode: (mode: Panel2Mode) => void;
  setActivePanel: (panel: ActivePanelId) => void;
  setPanel1Selection: (selection: FileEntry[]) => void;
  setSidebarWidth: (width: number) => void;
  setPanel1Width: (width: number) => void;
  setClipboard: (clipboard: FileClipboard) => void;
  bumpRefresh: () => void;
}

export type FileExplorerStore = UseBoundStore<StoreApi<FileExplorerState>>;

/**
 * Each File Explorer tab gets its own store instance (created via this factory,
 * one per mounted `FileExplorerMain`) rather than a single module-level store --
 * otherwise every open File Explorer tab would share the same panel paths/selection.
 */
export function createFileExplorerStore(): FileExplorerStore {
  return create<FileExplorerState>((set, get) => ({
    panel1Path: null,
    panel2Path: null,
    panel2Mode: 'table',
    activePanel: 'panel1',
    panel1Selection: [],

    sidebarWidth: 200,
    panel1Width: 50,

    clipboard: null,
    refreshSignal: 0,

    setPanel1Path: (path) => set({ panel1Path: path }),
    setPanel2Path: (path) => set({ panel2Path: path }),
    setPanel2Mode: (mode) =>
      set({
        panel2Mode: mode,
        // Panel 2 has no independent location while previewing, so switching into
        // preview mode always snaps sidebar-driven navigation back to Panel 1.
        activePanel: mode === 'preview' ? 'panel1' : get().activePanel
      }),
    setActivePanel: (panel) => set({ activePanel: panel }),
    setPanel1Selection: (selection) => set({ panel1Selection: selection }),
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
