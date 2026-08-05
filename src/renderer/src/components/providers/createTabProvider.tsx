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
  options: {
    storageKey: string;
    initialTabs?: () => Tab<TTool>[];
    /** Called the first time a tab of a given `type` becomes the active tab in this
     * session -- whether via a brand-new tab or switching to an already-open one --
     * never once per `openTab`/`selectTab` call. Kept as a plain callback rather than
     * an import so this generic tab-system factory stays decoupled from what a caller
     * does with the notification (telemetry, in ToolProvider.ts's case). */
    onTabActivated?: (type: TabType<TTool>) => void;
  }
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

  // Module-scope (not component state) so it survives remounts and naturally resets
  // per app launch, matching "once per (tool, session)" -- rehydration from the
  // persisted `activeTabId` on reload doesn't re-report a tool that was already open
  // before, only tools that become active for the first time in *this* run.
  const reportedTypes = new Set<TabType<TTool>>();
  function reportActiveTab(state: TabsState<TTool>): void {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (tab && !reportedTypes.has(tab.type)) {
      reportedTypes.add(tab.type);
      options.onTabActivated?.(tab.type);
    }
  }
  // subscribe() only fires on later changes, so the tab that's already active at
  // creation time (the initial tab, or whatever rehydrated before this line ran)
  // needs its own explicit check here.
  reportActiveTab(useTabsStore.getState());
  useTabsStore.subscribe(reportActiveTab);

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
