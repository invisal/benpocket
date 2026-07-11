import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, WsAckResult } from '../../../../preload/http-client/types';

/** Throws with the server's error message when a mutation IPC call fails, so callers can surface it. */
function assertOk(result: WsAckResult): void {
  if (!result.ok) throw new Error(result.error ?? 'Something went wrong.');
}

interface WorkspacesState {
  workspaces: Workspace[];
  isLoaded: boolean;
  activeWorkspaceId: string | null;
  load: () => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  setActiveWorkspaceId: (workspaceId: string) => void;
}

// Renderer-side cache of the main-process workspaces store (source of truth,
// persisted to disk), mirroring environments.store.ts. Only which workspace is
// "active" is persisted here (localStorage), since that's pure UI/session state.
export const useWorkspacesStore = create<WorkspacesState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      isLoaded: false,
      activeWorkspaceId: null,

      load: async () => {
        const workspaces = await window.api.workspaces.list();
        set((state) => ({
          workspaces,
          isLoaded: true,
          activeWorkspaceId: workspaces.some((w) => w.id === state.activeWorkspaceId)
            ? state.activeWorkspaceId
            : (workspaces[0]?.id ?? null)
        }));
      },

      createWorkspace: async (name) => {
        const workspace = await window.api.workspaces.create(name);
        await get().load();
        set({ activeWorkspaceId: workspace.id });
        return workspace;
      },

      renameWorkspace: async (workspaceId, name) => {
        assertOk(await window.api.workspaces.rename({ workspaceId, name }));
        await get().load();
      },

      deleteWorkspace: async (workspaceId) => {
        assertOk(await window.api.workspaces.remove({ workspaceId }));
        await get().load();
      },

      setActiveWorkspaceId: (workspaceId) => set({ activeWorkspaceId: workspaceId })
    }),
    {
      name: 'craftbox-active-workspace',
      partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId })
    }
  )
);
