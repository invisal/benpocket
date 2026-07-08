import {
  ComponentType,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';

interface ToolComponentProps<Payload> {
  id: string;
  payload: Payload;
  isTabActive: boolean;
}

interface Tool<Name extends string = string, Payload = unknown> {
  name: Name;
  label: string;
  component: ComponentType<ToolComponentProps<Payload>>;
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

type Tab<TTool extends Tool<string, unknown>> = BaseTab & TabShape<TTool>;
type TabType<TTool extends Tool<string, unknown>> = Tab<TTool>['type'];

interface TabContextValue<TTool extends Tool<string, unknown>> {
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

interface State<TTool extends Tool<string, unknown>> {
  tabs: Tab<TTool>[];
  activeTabId: string | undefined;
}

/**
 * Builds an isolated tab system (context + provider + hook) for one region of the
 * UI (e.g. the sidebar). Each call produces its own state tree and its own React
 * context, so independent tab regions never see or affect each other's tabs.
 */
export function createTabProvider<TTool extends Tool<string, unknown>>(tools: readonly TTool[]) {
  const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool])) as Record<
    TabType<TTool>,
    TTool
  >;

  const TabContext = createContext<TabContextValue<TTool> | undefined>(undefined);

  function useTabs(): TabContextValue<TTool> {
    const ctx = useContext(TabContext);
    if (!ctx) {
      throw new Error('useTabs must be used within its matching <TabProvider>');
    }
    return ctx;
  }

  function TabProvider({
    children,
    initialTabs
  }: {
    children: ReactNode;
    initialTabs?: () => Tab<TTool>[];
  }) {
    const [state, setState] = useState<State<TTool>>(() => {
      const tabs = initialTabs?.() ?? [];
      return { tabs, activeTabId: tabs[0]?.id };
    });

    // Implemented loosely (payload: unknown) because TS cannot unify a generic
    // function type against TabContextValue['openTab'] across a discriminated
    // union; the single cast below restores the precise per-`type` signature
    // for callers.
    const openTab = useCallback(
      (type: TabType<TTool>, payload: unknown, options?: { title?: string; subtitle?: string }) => {
        const id = crypto.randomUUID();

        setState((prev) => {
          const tool = toolsByName[type];
          const count = prev.tabs.filter((t) => t.type === type).length + 1;
          const title = options?.title ?? `${tool.generateName(payload as never)} ${count}`;
          const tab = { id, title, subtitle: options?.subtitle, type, payload } as Tab<TTool>;
          return { tabs: [...prev.tabs, tab], activeTabId: id };
        });

        return id;
      },
      []
    ) as TabContextValue<TTool>['openTab'];

    const closeTab = useCallback((id: string) => {
      setState((prev) => {
        const idx = prev.tabs.findIndex((t) => t.id === id);
        if (idx === -1) return prev;

        const tabs = prev.tabs.filter((t) => t.id !== id);
        const activeTabId =
          prev.activeTabId !== id ? prev.activeTabId : tabs[Math.min(idx, tabs.length - 1)]?.id;

        return { tabs, activeTabId };
      });
    }, []);

    const selectTab = useCallback((id: string) => {
      setState((prev) => ({ ...prev, activeTabId: id }));
    }, []);

    const renameTab = useCallback((id: string, title: string) => {
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === id ? { ...t, title } : t))
      }));
    }, []);

    const value = useMemo<TabContextValue<TTool>>(
      () => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        openTab,
        closeTab,
        selectTab,
        renameTab
      }),
      [state, openTab, closeTab, selectTab, renameTab]
    );

    return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
  }

  function TabOutlet({ tab }: { tab: Tab<TTool> }) {
    const { activeTabId } = useTabs();
    const tool = toolsByName[tab.type];
    const Component = tool.component as ComponentType<ToolComponentProps<unknown>>;
    return <Component id={tab.id} payload={tab.payload} isTabActive={tab.id === activeTabId} />;
  }

  function TabSwitcher({ emptyState }: { emptyState?: ReactNode }) {
    const { tabs, activeTabId } = useTabs();

    if (tabs.length === 0) {
      return emptyState ?? null;
    }

    return (
      <>
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`absolute inset-0 ${
                isTabActive ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
              }`}
            >
              <TabOutlet tab={tab} />
            </div>
          );
        })}
      </>
    );
  }

  return { TabContext, TabProvider, useTabs, TabOutlet, TabSwitcher, toolsByName };
}
