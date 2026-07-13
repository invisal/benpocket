/* eslint-disable @typescript-eslint/no-explicit-any */
import { Activity, type ComponentType, lazy, type ReactNode, Suspense } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ToolComponentProps<Payload> {
  id: string;
  payload: Payload;
  isTabActive: boolean;
}

interface Tool<Name extends string = string, Payload = unknown> {
  name: Name;
  label: string;
  /** Dynamic import of the tool's entry module, keyed off its own file rather than an
   * eagerly-imported reference, so the registry doesn't statically depend on -- and
   * therefore doesn't get HMR-invalidated by -- a tool's implementation files. */
  loadComponent: () => Promise<{ default: ComponentType<ToolComponentProps<Payload>> }>;
  generateName: (payload: Payload) => string;
}

export function registerTool<Name extends string, Payload>(
  tool: Tool<Name, Payload>
): Tool<Name, Payload> {
  return tool;
}

interface BaseTab {
  id: string;
  title: string;
  subtitle?: string;
}

type TabShape<TTool> =
  TTool extends Tool<infer Name extends string, infer Payload>
    ? { type: Name; payload: Payload }
    : never;

type Tab<TTool extends Tool<string, any>> = BaseTab & TabShape<TTool>;
type TabType<TTool extends Tool<string, any>> = Tab<TTool>['type'];

interface TabsState<TTool extends Tool<string, any>> {
  tabs: Tab<TTool>[];
  activeTabId: string | undefined;
  openTab: <T extends TabType<TTool>>(
    type: T,
    payload: Extract<Tab<TTool>, { type: T }>['payload'],
    options?: { title?: string; subtitle?: string }
  ) => string;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

/**
 * Builds a Zustand-backed tab system for one region of the UI (e.g. the top-level
 * tool switcher). The store lives outside the React tree, so unlike a Context-based
 * implementation, Fast Refresh reloading a tool's own module doesn't tear down a
 * Provider and reset every open tab -- state also persists to localStorage so a
 * full page reload restores exactly what was open.
 */
export function createTabProvider<TTool extends Tool<string, any>>(
  tools: readonly TTool[],
  options: { storageKey: string; initialTabs?: () => Tab<TTool>[] }
) {
  const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool])) as Record<
    TabType<TTool>,
    TTool
  >;

  // Created once per tool at registry setup so identity is stable across renders --
  // `lazy()` remounts and re-fetches its component whenever it's handed a new reference.
  const lazyComponentByName = Object.fromEntries(
    tools.map((tool) => [tool.name, lazy(tool.loadComponent)])
  ) as unknown as Record<TabType<TTool>, ComponentType<ToolComponentProps<unknown>>>;

  const initialTabs = options.initialTabs?.() ?? [];

  const useTabsStore = create<TabsState<TTool>>()(
    persist(
      (set, get) => ({
        tabs: initialTabs,
        activeTabId: initialTabs[0]?.id,

        // Implemented loosely (type/payload untyped) because TS cannot unify a generic
        // function body against TabsState['openTab'] across a discriminated union; the
        // cast below restores the precise per-`type` signature for callers.
        openTab: ((
          type: TabType<TTool>,
          payload: unknown,
          opts?: { title?: string; subtitle?: string }
        ) => {
          const id = crypto.randomUUID();
          const tool = toolsByName[type];
          const count = get().tabs.filter((t) => t.type === type).length + 1;
          const title = opts?.title ?? `${tool.generateName(payload as never)} ${count}`;
          const tab = { id, title, subtitle: opts?.subtitle, type, payload } as Tab<TTool>;
          set((prev) => ({ tabs: [...prev.tabs, tab], activeTabId: id }));
          return id;
        }) as TabsState<TTool>['openTab'],

        closeTab: (id) => {
          set((prev) => {
            const idx = prev.tabs.findIndex((t) => t.id === id);
            if (idx === -1) return prev;

            const tabs = prev.tabs.filter((t) => t.id !== id);
            const activeTabId =
              prev.activeTabId !== id ? prev.activeTabId : tabs[Math.min(idx, tabs.length - 1)]?.id;

            return { tabs, activeTabId };
          });
        },

        selectTab: (id) => set({ activeTabId: id }),

        renameTab: (id, title) =>
          set((prev) => ({
            tabs: prev.tabs.map((t) => (t.id === id ? { ...t, title } : t))
          }))
      }),
      {
        name: options.storageKey,
        partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId })
      }
    )
  );

  function useTabs(): TabsState<TTool> {
    return useTabsStore();
  }

  function ToolOutlet({ tab }: { tab: Tab<TTool> }) {
    const activeTabId = useTabsStore((s) => s.activeTabId);
    const Component = lazyComponentByName[tab.type];
    return (
      <Suspense fallback={null}>
        <Component id={tab.id} payload={tab.payload} isTabActive={tab.id === activeTabId} />
      </Suspense>
    );
  }

  function TabSwitcher({ emptyState }: { emptyState?: ReactNode }) {
    const tabs = useTabsStore((s) => s.tabs);
    const activeTabId = useTabsStore((s) => s.activeTabId);

    if (tabs.length === 0) {
      return emptyState ?? null;
    }

    return (
      <>
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTabId;
          return (
            <Activity key={tab.id} mode={isTabActive ? 'visible' : 'hidden'}>
              <div key={tab.id} className="flex h-full w-full flex-col">
                <ToolOutlet tab={tab} />
              </div>
            </Activity>
          );
        })}
      </>
    );
  }

  return { useTabs, TabSwitcher, toolsByName };
}
