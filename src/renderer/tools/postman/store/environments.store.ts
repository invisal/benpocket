import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Environment, KeyValuePair } from '../../../../preload/postman/types';

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
        const environments = await window.api.environments.list();
        set({ environments, isLoaded: true });
      },

      createEnvironment: async (name) => {
        const environment = await window.api.environments.create(name);
        await get().load();
        set({ activeEnvironmentId: environment.id });
        return environment;
      },

      renameEnvironment: async (environmentId, name) => {
        await window.api.environments.rename({ environmentId, name });
        await get().load();
      },

      deleteEnvironment: async (environmentId) => {
        await window.api.environments.remove({ environmentId });
        await get().load();
        set((state) => (state.activeEnvironmentId === environmentId ? { activeEnvironmentId: null } : {}));
      },

      saveVariables: async (environmentId, variables) => {
        await window.api.environments.saveVariables({ environmentId, variables });
        await get().load();
      },

      setActiveEnvironmentId: (environmentId) => set({ activeEnvironmentId: environmentId })
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
    (state) => state.environments.find((e) => e.id === state.activeEnvironmentId)?.variables ?? EMPTY_VARIABLES
  );
}
