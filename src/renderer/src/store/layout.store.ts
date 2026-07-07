import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tab {
  id: string;
  title: string;
  type: 'lens' | 'postman' | 'screenstudio' | 'home';
  instanceId: string;
  /** Tool-specific tab seed data (e.g. PostmanTabSeed). Each tool narrows/casts this at its own read site. */
  meta?: unknown;
}

export interface ActivityInstance {
  id: string;
  type: 'lens' | 'postman' | 'screenstudio';
  title: string;
}

interface LayoutState {
  activeActivity: 'lens' | 'postman' | 'screenstudio' | null;
  isLeftPanelOpen: boolean;
  leftPanelWidth: number;
  isRightPanelOpen: boolean;
  rightPanelWidth: number;
  isBottomPanelOpen: boolean;
  bottomPanelHeight: number;
  openTabs: Tab[];
  activeTabId: string | null;

  // Dynamic instances state
  activeInstances: ActivityInstance[];
  activeInstanceId: string | 'home';

  // Per-instance K8s config states
  lensInstanceCluster: Record<string, string>;
  lensInstanceNamespace: Record<string, string>;
  lensInstanceResource: Record<
    string,
    'overview' | 'pods' | 'deployments' | 'services' | 'configmaps'
  >;

  // Layout Toggle Actions
  toggleLeftPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;

  // Tab Actions
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  renameTab: (id: string, title: string) => void;

  // Lens K8s Actions per instance
  setLensInstanceCluster: (instanceId: string, cluster: string) => void;
  setLensInstanceNamespace: (instanceId: string, ns: string) => void;
  setLensInstanceResource: (
    instanceId: string,
    resource: 'overview' | 'pods' | 'deployments' | 'services' | 'configmaps'
  ) => void;

  // Instance Lifecycle Actions
  addActivityInstance: (type: 'lens' | 'postman' | 'screenstudio') => void;
  closeActivityInstance: (id: string) => void;
  setActiveInstanceId: (id: string | 'home') => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
  activeActivity: null,
  isLeftPanelOpen: true,
  leftPanelWidth: 260,
  isRightPanelOpen: false,
  rightPanelWidth: 260,
  isBottomPanelOpen: true,
  bottomPanelHeight: 200,
  openTabs: [],
  activeTabId: null,

  activeInstances: [],
  activeInstanceId: 'home',

  lensInstanceCluster: {},
  lensInstanceNamespace: {},
  lensInstanceResource: {},

  toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.max(150, Math.min(width, 600)) }),

  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(150, Math.min(width, 500)) }),

  toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(80, Math.min(height, 500)) }),

  openTab: (tab) =>
    set((state) => {
      const tabExists = state.openTabs.some((t) => t.id === tab.id);
      const newTabs = tabExists ? state.openTabs : [...state.openTabs, tab];
      return {
        openTabs: newTabs,
        activeTabId: tab.id
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const tabToClose = state.openTabs.find((t) => t.id === id);
      const filteredTabs = state.openTabs.filter((t) => t.id !== id);
      let nextActiveId = state.activeTabId;

      if (state.activeTabId === id && tabToClose) {
        // Find another tab belonging to the same instance
        const siblingTabs = filteredTabs.filter((t) => t.instanceId === tabToClose.instanceId);
        if (siblingTabs.length > 0) {
          nextActiveId = siblingTabs[siblingTabs.length - 1].id;
        } else {
          nextActiveId = null;
        }
      }

      return {
        openTabs: filteredTabs,
        activeTabId: nextActiveId
      };
    }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  renameTab: (id, title) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === id ? { ...t, title } : t))
    })),

  setLensInstanceCluster: (instanceId, cluster) =>
    set((state) => ({
      lensInstanceCluster: { ...state.lensInstanceCluster, [instanceId]: cluster }
    })),

  setLensInstanceNamespace: (instanceId, ns) =>
    set((state) => ({
      lensInstanceNamespace: { ...state.lensInstanceNamespace, [instanceId]: ns }
    })),

  setLensInstanceResource: (instanceId, resource) =>
    set((state) => ({
      lensInstanceResource: { ...state.lensInstanceResource, [instanceId]: resource }
    })),

  addActivityInstance: (type) =>
    set((state) => {
      const instanceId = `${type}-${Date.now()}`;
      const typeCount = state.activeInstances.filter((i) => i.type === type).length + 1;
      const appNames = {
        lens: 'Lens K8s',
        postman: 'Postman',
        screenstudio: 'ScreenStudio'
      };
      const title = `${appNames[type]} (${typeCount})`;

      const newInstance: ActivityInstance = {
        id: instanceId,
        type,
        title
      };

      // Create a default tab for the newly spawned instance
      let defaultTabId = '';
      let defaultTabTitle = '';
      if (type === 'lens') {
        defaultTabId = `lens-k8s-dashboard-${instanceId}`;
        defaultTabTitle = 'K8s Overview';
      } else if (type === 'postman') {
        defaultTabId = `postman-req-${instanceId}`;
        defaultTabTitle = 'New API Request';
      } else if (type === 'screenstudio') {
        defaultTabId = `screenstudio-session-${instanceId}`;
        defaultTabTitle = 'Screen Recording';
      }

      const defaultTab: Tab = {
        id: defaultTabId,
        title: defaultTabTitle,
        type,
        instanceId
      };

      return {
        activeInstances: [...state.activeInstances, newInstance],
        activeInstanceId: instanceId,
        activeActivity: type,
        openTabs: [...state.openTabs, defaultTab],
        activeTabId: defaultTabId,
        isLeftPanelOpen: true,
        // Pre-populate K8s defaults for Lens instance
        lensInstanceCluster: { ...state.lensInstanceCluster, [instanceId]: 'minikube' },
        lensInstanceNamespace: { ...state.lensInstanceNamespace, [instanceId]: 'All Namespaces' },
        lensInstanceResource: { ...state.lensInstanceResource, [instanceId]: 'overview' }
      };
    }),

  closeActivityInstance: (id) =>
    set((state) => {
      const closedIndex = state.activeInstances.findIndex((i) => i.id === id);
      const remainingInstances = state.activeInstances.filter((i) => i.id !== id);
      const filteredTabs = state.openTabs.filter((t) => t.instanceId !== id);

      let nextInstanceId: string | 'home' = 'home';
      let nextActivity: 'lens' | 'postman' | 'screenstudio' | null = null;
      let nextActiveTabId: string | null = null;

      if (state.activeInstanceId === id) {
        if (remainingInstances.length > 0) {
          const newFocusedIndex = Math.max(0, closedIndex - 1);
          const nextInstance = remainingInstances[newFocusedIndex];
          nextInstanceId = nextInstance.id;
          nextActivity = nextInstance.type;

          // Find the last active tab for the newly focused instance
          const instanceTabs = filteredTabs.filter((t) => t.instanceId === nextInstanceId);
          if (instanceTabs.length > 0) {
            nextActiveTabId = instanceTabs[instanceTabs.length - 1].id;
          }
        }
      } else {
        // If we closed a background instance, keep current active focus
        nextInstanceId = state.activeInstanceId;
        nextActivity = state.activeActivity;
        nextActiveTabId = state.activeTabId;
      }

      return {
        activeInstances: remainingInstances,
        activeInstanceId: nextInstanceId,
        activeActivity: nextActivity,
        openTabs: filteredTabs,
        activeTabId: nextActiveTabId
      };
    }),

  setActiveInstanceId: (id) =>
    set((state) => {
      // Toggle Left Panel if clicking the already active application instance
      if (state.activeInstanceId === id && id !== 'home') {
        return { isLeftPanelOpen: !state.isLeftPanelOpen };
      }

      let activeActivity: 'lens' | 'postman' | 'screenstudio' | null = null;
      let nextActiveTabId: string | null = null;

      if (id !== 'home') {
        const instance = state.activeInstances.find((i) => i.id === id);
        if (instance) {
          activeActivity = instance.type;
          // Retrieve last active tab of this instance
          const instanceTabs = state.openTabs.filter((t) => t.instanceId === id);
          if (instanceTabs.length > 0) {
            nextActiveTabId = instanceTabs[instanceTabs.length - 1].id;
          }
        }
      }

      return {
        activeInstanceId: id,
        activeActivity,
        activeTabId: nextActiveTabId,
        isLeftPanelOpen: id !== 'home' ? true : state.isLeftPanelOpen
      };
    })
    }),
    {
      name: 'craftbox-layout',
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        activeInstances: state.activeInstances,
        activeInstanceId: state.activeInstanceId,
        activeActivity: state.activeActivity
      })
    }
  )
);
