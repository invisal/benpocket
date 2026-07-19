import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useKuberneterStore } from '../../tools/kuberneter/store/kuberneter.store';

export interface Tab {
  id: string;
  title: string;
  type: 'kuberneter' | 'postman' | 'screenrecorder' | 'home';
  instanceId: string;
  /** Tool-specific tab seed data (e.g. PostmanTabSeed). Each tool narrows/casts this at its own read site. */
  meta?: unknown;
  isPreview?: boolean;
}

export interface ActivityInstance {
  id: string;
  type: 'kuberneter' | 'postman' | 'screenrecorder';
  title: string;
}

interface LayoutState {
  activeActivity: 'kuberneter' | 'postman' | 'screenrecorder' | null;
  isRightPanelOpen: boolean;
  rightPanelWidth: number;
  openTabs: Tab[];
  activeTabId: string | null;

  // Dynamic instances state
  activeInstances: ActivityInstance[];
  activeInstanceId: string | 'home';

  // Layout Toggle Actions
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;

  // Tab Actions
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  renameTab: (id: string, title: string) => void;
  pinTab: (id: string) => void;
  closeOthers: (id: string) => void;
  closeToRight: (id: string) => void;
  closeAll: (instanceId: string) => void;

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
      isRightPanelOpen: false,
      rightPanelWidth: 260,
      openTabs: [],
      activeTabId: null,

      activeInstances: [],
      activeInstanceId: 'home',

      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(150, Math.min(width, 500)) }),

      openTab: (tab) =>
        set((state) => {
          const tabExists = state.openTabs.some((t) => t.id === tab.id);

          if (tabExists) {
            return {
              activeTabId: tab.id
            };
          }

          // Check if there is an unsticky/preview tab in the same instance
          const previewTab = state.openTabs.find(
            (t) => t.instanceId === tab.instanceId && t.isPreview
          );

          const isNewTabPreview = tab.isPreview === true;
          let newTabs: Tab[];

          if (previewTab) {
            // Overwrite the existing preview tab with the new tab
            const newTab = { ...tab, isPreview: isNewTabPreview };
            newTabs = state.openTabs.map((t) => (t.id === previewTab.id ? newTab : t));
          } else {
            // Add as a new tab
            const newTab = { ...tab, isPreview: isNewTabPreview };
            newTabs = [...state.openTabs, newTab];
          }

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

      pinTab: (id) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) => (t.id === id ? { ...t, isPreview: false } : t))
        })),

      closeOthers: (id) =>
        set((state) => {
          const targetTab = state.openTabs.find((t) => t.id === id);
          if (!targetTab) return {};

          const newTabs = state.openTabs.filter(
            (t) => t.instanceId !== targetTab.instanceId || t.id === id
          );

          return {
            openTabs: newTabs,
            activeTabId: id
          };
        }),

      closeToRight: (id) =>
        set((state) => {
          const targetTab = state.openTabs.find((t) => t.id === id);
          if (!targetTab) return {};

          const instanceTabs = state.openTabs.filter((t) => t.instanceId === targetTab.instanceId);
          const targetIndex = instanceTabs.findIndex((t) => t.id === id);
          if (targetIndex === -1) return {};

          const tabIdsToClose = new Set(instanceTabs.slice(targetIndex + 1).map((t) => t.id));

          const newTabs = state.openTabs.filter((t) => !tabIdsToClose.has(t.id));

          let nextActiveId = state.activeTabId;
          if (nextActiveId && tabIdsToClose.has(nextActiveId)) {
            nextActiveId = id;
          }

          return {
            openTabs: newTabs,
            activeTabId: nextActiveId
          };
        }),

      closeAll: (instanceId) =>
        set((state) => {
          const newTabs = state.openTabs.filter((t) => t.instanceId !== instanceId);

          let nextActiveId = state.activeTabId;
          const activeTab = state.openTabs.find((t) => t.id === state.activeTabId);
          if (activeTab && activeTab.instanceId === instanceId) {
            nextActiveId = null;
          }

          return {
            openTabs: newTabs,
            activeTabId: nextActiveId
          };
        }),

      addActivityInstance: (type, customId, context) =>
        set((state) => {
          const instanceId = customId || `${type}-${Date.now()}`;
          const appNames = {
            kuberneter: 'Kuberneter',
            postman: 'HTTP Client',
            screenrecorder: 'ScreenRecorder'
          };
          const title = appNames[type];

          const newInstance: ActivityInstance = {
            id: instanceId,
            type,
            title
          };

          // Create a default tab for the newly spawned instance
          let defaultTab: Tab | null = null;
          let defaultTabId = '';
          if (type === 'kuberneter') {
            if (context?.cluster) {
              defaultTabId = `kuberneter-k8s-overview-${instanceId}`;
              defaultTab = {
                id: defaultTabId,
                title: 'Cluster Overview',
                type: 'kuberneter',
                instanceId,
                meta: { resource: 'overview' }
              };
            }
          } else if (type === 'postman') {
            defaultTabId = `postman-req-${instanceId}`;
            defaultTab = {
              id: defaultTabId,
              title: 'New API Request',
              type,
              instanceId
            };
          } else if (type === 'screenrecorder') {
            defaultTabId = `screenrecorder-session-${instanceId}`;
            defaultTab = {
              id: defaultTabId,
              title: 'Screen Recording',
              type,
              instanceId
            };
          }

          // IMPORTANT: If this is a kuberneter instance, we initialize its private store
          if (type === 'kuberneter') {
            useKuberneterStore.getState().initInstance(instanceId, context);
          }

          return {
            activeInstances: [...state.activeInstances, newInstance],
            activeInstanceId: instanceId,
            activeActivity: type,
            openTabs: defaultTab ? [...state.openTabs, defaultTab] : state.openTabs,
            activeTabId: defaultTab ? defaultTabId : null
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
            activeTabId: nextActiveTabId
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
