import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tab {
  id: string;
  title: string;
  type: 'kuberneter' | 'postman' | 'screenrecorder' | 'home';
  instanceId: string;
  /** Tool-specific tab seed data (e.g. PostmanTabSeed). Each tool narrows/casts this at its own read site. */
  meta?: unknown;
}

export interface ActivityInstance {
  id: string;
  type: 'kuberneter' | 'postman' | 'screenrecorder';
  title: string;
}

export interface RecentConnection {
  contextName: string;
  configPath: string;
  server?: string;
  timestamp: number;
}

interface LayoutState {
  activeActivity: 'kuberneter' | 'postman' | 'screenrecorder' | null;
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
  kuberneterInstanceCluster: Record<string, string>;
  kuberneterInstanceNamespace: Record<string, string>;
  kuberneterInstanceResource: Record<string, string>;
  kuberneterInstanceConfigPath: Record<string, string>;
  setKuberneterInstanceConfigPath: (instanceId: string, path: string) => void;

  // Managed kubeconfigs list (persisted)
  kuberneterKubeconfigs: string[];
  addKuberneterKubeconfig: (filePath: string) => void;
  removeKuberneterKubeconfig: (filePath: string) => void;

  // Recent connections history (persisted)
  kuberneterRecentConnections: RecentConnection[];
  addKuberneterRecentConnection: (contextName: string, configPath: string, server?: string) => void;

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

  // Kuberneter K8s Actions per instance
  setKuberneterInstanceCluster: (instanceId: string, cluster: string) => void;
  setKuberneterInstanceNamespace: (instanceId: string, ns: string) => void;
  setKuberneterInstanceResource: (instanceId: string, resource: string) => void;

  // Instance Lifecycle Actions
  addActivityInstance: (
    type: 'kuberneter' | 'postman' | 'screenrecorder',
    customId?: string,
    KuberneteContext?: { cluster: string; configPath: string; namespace?: string }
  ) => void;
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

      kuberneterInstanceCluster: {},
      kuberneterInstanceNamespace: {},
      kuberneterInstanceResource: {},
      kuberneterInstanceConfigPath: {},
      kuberneterKubeconfigs: [],
      kuberneterRecentConnections: [],

      toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
      setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.max(150, Math.min(width, 600)) }),

      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(150, Math.min(width, 500)) }),

      toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
      setBottomPanelHeight: (height) =>
        set({ bottomPanelHeight: Math.max(80, Math.min(height, 500)) }),

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

      setKuberneterInstanceCluster: (instanceId, cluster) =>
        set((state) => ({
          kuberneterInstanceCluster: { ...state.kuberneterInstanceCluster, [instanceId]: cluster }
        })),

      setKuberneterInstanceNamespace: (instanceId, ns) =>
        set((state) => ({
          kuberneterInstanceNamespace: { ...state.kuberneterInstanceNamespace, [instanceId]: ns }
        })),

      setKuberneterInstanceResource: (instanceId, resource) =>
        set((state) => ({
          kuberneterInstanceResource: {
            ...state.kuberneterInstanceResource,
            [instanceId]: resource
          }
        })),

      setKuberneterInstanceConfigPath: (instanceId, path) =>
        set((state) => ({
          kuberneterInstanceConfigPath: {
            ...state.kuberneterInstanceConfigPath,
            [instanceId]: path
          }
        })),

      addKuberneterKubeconfig: (filePath) =>
        set((state) => {
          if (state.kuberneterKubeconfigs.includes(filePath)) return state;
          return { kuberneterKubeconfigs: [...state.kuberneterKubeconfigs, filePath] };
        }),

      removeKuberneterKubeconfig: (filePath) =>
        set((state) => ({
          kuberneterKubeconfigs: state.kuberneterKubeconfigs.filter((p) => p !== filePath)
        })),

      addKuberneterRecentConnection: (contextName, configPath, server) =>
        set((state) => {
          const filtered = state.kuberneterRecentConnections.filter(
            (c) => !(c.contextName === contextName && c.configPath === configPath)
          );
          const newRecent: RecentConnection = {
            contextName,
            configPath,
            server,
            timestamp: Date.now()
          };
          return {
            kuberneterRecentConnections: [newRecent, ...filtered].slice(0, 10)
          };
        }),

      addActivityInstance: (type, customId, context) =>
        set((state) => {
          const instanceId = customId || `${type}-${Date.now()}`;
          const typeCount = state.activeInstances.filter((i) => i.type === type).length + 1;
          const appNames = {
            kuberneter: 'Kuberneter',
            postman: 'HTTP Client',
            screenrecorder: 'ScreenRecorder'
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
          if (type === 'kuberneter') {
            defaultTabId = `kuberneter-home-${instanceId}`;
            defaultTabTitle = 'Home';
          } else if (type === 'postman') {
            defaultTabId = `postman-req-${instanceId}`;
            defaultTabTitle = 'New API Request';
          } else if (type === 'screenrecorder') {
            defaultTabId = `screenrecorder-session-${instanceId}`;
            defaultTabTitle = 'Screen Recording';
          }

          const defaultTab: Tab = {
            id: defaultTabId,
            title: defaultTabTitle,
            type,
            instanceId,
            ...(type === 'kuberneter' ? { meta: { resource: 'home' } } : {})
          };

          return {
            activeInstances: [...state.activeInstances, newInstance],
            activeInstanceId: instanceId,
            activeActivity: type,
            openTabs: [...state.openTabs, defaultTab],
            activeTabId: defaultTabId,
            isLeftPanelOpen: true,
            // Pre-populate K8s defaults for Kuberneter instance
            kuberneterInstanceCluster: {
              ...state.kuberneterInstanceCluster,
              [instanceId]: context?.cluster || ''
            },
            kuberneterInstanceConfigPath: {
              ...state.kuberneterInstanceConfigPath,
              [instanceId]: context?.configPath || 'default'
            },
            kuberneterInstanceNamespace: {
              ...state.kuberneterInstanceNamespace,
              [instanceId]: context?.namespace || 'All Namespaces'
            },
            kuberneterInstanceResource: {
              ...state.kuberneterInstanceResource,
              [instanceId]: context?.cluster ? 'overview' : 'home'
            }
          };
        }),

      closeActivityInstance: (id) =>
        set((state) => {
          const closedIndex = state.activeInstances.findIndex((i) => i.id === id);
          const remainingInstances = state.activeInstances.filter((i) => i.id !== id);
          const filteredTabs = state.openTabs.filter((t) => t.instanceId !== id);

          let nextInstanceId: string | 'home' = 'home';
          let nextActivity: 'kuberneter' | 'postman' | 'screenrecorder' | null = null;
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

          let activeActivity: 'kuberneter' | 'postman' | 'screenrecorder' | null = null;
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
        activeActivity: state.activeActivity,
        kuberneterKubeconfigs: state.kuberneterKubeconfigs,
        kuberneterInstanceCluster: state.kuberneterInstanceCluster,
        kuberneterInstanceNamespace: state.kuberneterInstanceNamespace,
        kuberneterInstanceResource: state.kuberneterInstanceResource,
        kuberneterInstanceConfigPath: state.kuberneterInstanceConfigPath,
        kuberneterRecentConnections: state.kuberneterRecentConnections
      })
    }
  )
);
