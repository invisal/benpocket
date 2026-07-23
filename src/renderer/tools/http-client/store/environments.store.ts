import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Environment,
  EnvironmentImportConflictChoice,
  ImportedEnvironmentDraft,
  ImportEnvironmentResult,
  KeyValuePair,
  WsAckResult
} from '../../../../preload/http-client/types';
import { useWorkspacesStore } from './workspaces.store';

/** Throws with the server's error message when a mutation IPC call fails, so callers can surface it. */
function assertOk(result: WsAckResult): void {
  if (!result.ok) throw new Error(result.error ?? 'Something went wrong.');
}

interface EnvironmentsState {
  environments: Environment[];
  isLoaded: boolean;
  activeEnvironmentId: string | null;
  load: () => Promise<void>;
  createEnvironment: (name: string) => Promise<Environment>;
  renameEnvironment: (environmentId: string, name: string) => Promise<void>;
  deleteEnvironment: (environmentId: string) => Promise<void>;
  saveVariables: (environmentId: string, variables: KeyValuePair[]) => Promise<void>;
  setActiveEnvironmentId: (environmentId: string | null) => void;
  /** Opens a file picker for a Postman Environment (.postman_environment.json) export. Resolves with a `conflict` when an environment of the same name already exists - the caller should ask the user to Replace/Copy and call `resolveEnvironmentImportConflict`. */
  importEnvironment: () => Promise<ImportEnvironmentResult>;
  resolveEnvironmentImportConflict: (
    existingId: string,
    draft: ImportedEnvironmentDraft,
    choice: EnvironmentImportConflictChoice
  ) => Promise<ImportEnvironmentResult>;
}

// Renderer-side cache of the main-process environments store (source of
// truth, persisted to disk), mirroring collections.store.ts. Only which
// environment is "active" is persisted here (localStorage), since that's
// pure UI/session state, not saved data.
export const useEnvironmentsStore = create<EnvironmentsState>()(
  persist(
    (set, get) => ({
      environments: [],
      isLoaded: false,
      activeEnvironmentId: null,

      load: async () => {
        const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
        const environments = workspaceId ? await window.api.environments.list(workspaceId) : [];
        set((state) => ({
          environments,
          isLoaded: true,
          // Clear the active environment if it belonged to a workspace we've since
          // switched away from (or it was deleted).
          activeEnvironmentId: environments.some((e) => e.id === state.activeEnvironmentId)
            ? state.activeEnvironmentId
            : null
        }));
      },

      createEnvironment: async (name) => {
        const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
        if (!workspaceId) throw new Error('No active workspace.');
        const environment = await window.api.environments.create({ name, workspaceId });
        await get().load();
        set({ activeEnvironmentId: environment.id });
        return environment;
      },

      renameEnvironment: async (environmentId, name) => {
        assertOk(await window.api.environments.rename({ environmentId, name }));
        await get().load();
      },

      deleteEnvironment: async (environmentId) => {
        assertOk(await window.api.environments.remove({ environmentId }));
        await get().load();
        set((state) =>
          state.activeEnvironmentId === environmentId ? { activeEnvironmentId: null } : {}
        );
      },

      saveVariables: async (environmentId, variables) => {
        assertOk(await window.api.environments.saveVariables({ environmentId, variables }));
        await get().load();
      },

      setActiveEnvironmentId: (environmentId) => set({ activeEnvironmentId: environmentId }),

      importEnvironment: async () => {
        const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
        if (!workspaceId) throw new Error('No active workspace.');
        const result = await window.api.environments.importFromFile(workspaceId);
        if (result.ok && result.environment) {
          await get().load();
          set({ activeEnvironmentId: result.environment.id });
        }
        return result;
      },

      resolveEnvironmentImportConflict: async (existingId, draft, choice) => {
        const workspaceId = useWorkspacesStore.getState().activeWorkspaceId;
        if (!workspaceId) throw new Error('No active workspace.');
        const result = await window.api.environments.resolveImportConflict({
          workspaceId,
          existingId,
          draft,
          choice
        });
        if (result.ok && result.environment) {
          await get().load();
          set({ activeEnvironmentId: result.environment.id });
        }
        return result;
      }
    }),
    {
      name: 'craftbox-active-environment',
      partialize: (state) => ({ activeEnvironmentId: state.activeEnvironmentId })
    }
  )
);

/** Non-reactive snapshot read for imperative code (e.g. resolving `{{vars}}` right before sending a request). */
export function getActiveEnvironmentVariables(): KeyValuePair[] {
  const state = useEnvironmentsStore.getState();
  return state.environments.find((e) => e.id === state.activeEnvironmentId)?.variables ?? [];
}

const EMPTY_VARIABLES: KeyValuePair[] = [];

/** Reactive hook version of {@link getActiveEnvironmentVariables}, for live-updating UI like `{{variable}}` autocomplete. */
export function useActiveEnvironmentVariables(): KeyValuePair[] {
  return useEnvironmentsStore(
    (state) =>
      state.environments.find((e) => e.id === state.activeEnvironmentId)?.variables ??
      EMPTY_VARIABLES
  );
}
