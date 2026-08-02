import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as jsYaml from 'js-yaml';
import { useLayoutStore } from '@renderer/store/layout.store';
import type { MetricCategory, MetricsSource, PrometheusProvider } from '../lib/metricsProviders';

export interface RecentConnection {
  contextName: string;
  configPath: string;
  server?: string;
  timestamp: number;
}

export interface DrawerState {
  isOpen: boolean;
  width: number;
  contentType: string | null;
  payload: unknown;
}

export interface MetricsConfig {
  source: MetricsSource;
  provider: PrometheusProvider;
  filterEmptyContainers: boolean;
  useHttps: boolean;
  pathPrefix: string;
  hiddenMetrics: MetricCategory[];
}

export interface KuberneterBottomPanelTab {
  id: string;
  type: 'terminal' | 'create-resource';
  title: string;
  initialCommand?: string;
  initialYaml?: string;
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  source: 'auto',
  provider: 'auto',
  filterEmptyContainers: true,
  useHttps: false,
  pathPrefix: '',
  hiddenMetrics: []
};

interface KuberneterState {
  kuberneterInstanceCluster: Record<string, string>;
  kuberneterInstanceServer: Record<string, string>;
  kuberneterInstanceNamespace: Record<string, string>;
  kuberneterInstanceResource: Record<string, string>;
  kuberneterInstanceConfigPath: Record<string, string>;
  kuberneterInstanceRefreshInterval: Record<string, string>;
  /** Per-cluster metrics configuration. Key is contextName. */
  kuberneterMetricsConfig: Record<string, MetricsConfig>;

  kuberneterKubeconfigs: string[];
  kuberneterRecentConnections: RecentConnection[];
  kuberneterTabDrawers: Record<string, DrawerState>;

  /** Bottom panel tabs state. */
  kuberneterBottomPanelTabs: KuberneterBottomPanelTab[];
  kuberneterActiveBottomPanelTabId: string;

  setKuberneterInstanceCluster: (instanceId: string, cluster: string) => void;
  setKuberneterInstanceServer: (instanceId: string, server: string) => void;
  setKuberneterInstanceNamespace: (instanceId: string, ns: string) => void;
  setKuberneterInstanceResource: (instanceId: string, resource: string) => void;
  setKuberneterInstanceConfigPath: (instanceId: string, path: string) => void;
  setKuberneterInstanceRefreshInterval: (instanceId: string, interval: string) => void;
  setKuberneterMetricsConfig: (contextName: string, config: Partial<MetricsConfig>) => void;

  setKuberneterTabDrawerState: (tabId: string, state: Partial<DrawerState>) => void;

  setKuberneterBottomPanelTabs: (tabs: KuberneterBottomPanelTab[]) => void;
  setKuberneterActiveBottomPanelTabId: (id: string) => void;
  addKuberneterBottomPanelTab: (tab: KuberneterBottomPanelTab) => void;
  closeKuberneterBottomPanelTab: (id: string) => void;
  openPodTerminalTab: (podName: string, namespace?: string, containerName?: string) => void;
  openPodLogsTab: (podName: string, namespace?: string, containerName?: string) => void;
  openPodEditTab: (podName: string, namespace?: string, rawItem?: unknown) => Promise<void>;
  openResourceEditTab: (
    resource: string,
    name: string,
    namespace?: string,
    rawItem?: unknown
  ) => Promise<void>;
  openNodeTerminalTab: (nodeName: string) => void;

  addKuberneterKubeconfig: (filePath: string) => void;
  removeKuberneterKubeconfig: (filePath: string) => void;
  addKuberneterRecentConnection: (contextName: string, configPath: string, server?: string) => void;

  initInstance: (
    instanceId: string,
    context?: { cluster: string; configPath: string; namespace?: string; server?: string }
  ) => void;
}

export const useKuberneterStore = create<KuberneterState>()(
  persist(
    (set, get) => ({
      kuberneterInstanceCluster: {},
      kuberneterInstanceServer: {},
      kuberneterInstanceNamespace: {},
      kuberneterInstanceResource: {},
      kuberneterInstanceConfigPath: {},
      kuberneterInstanceRefreshInterval: {},
      kuberneterMetricsConfig: {},
      kuberneterKubeconfigs: [],
      kuberneterTabDrawers: {},

      kuberneterBottomPanelTabs: [{ id: 'term-default', type: 'terminal', title: 'Terminal' }],
      kuberneterActiveBottomPanelTabId: 'term-default',

      setKuberneterBottomPanelTabs: (tabs) => set({ kuberneterBottomPanelTabs: tabs }),
      setKuberneterActiveBottomPanelTabId: (id) => set({ kuberneterActiveBottomPanelTabId: id }),

      addKuberneterBottomPanelTab: (tab) =>
        set((state) => ({
          kuberneterBottomPanelTabs: [...state.kuberneterBottomPanelTabs, tab],
          kuberneterActiveBottomPanelTabId: tab.id
        })),

      closeKuberneterBottomPanelTab: (id) =>
        set((state) => {
          const remaining = state.kuberneterBottomPanelTabs.filter((t) => t.id !== id);
          if (remaining.length === 0) {
            const defaultTerm: KuberneterBottomPanelTab = {
              id: `term-${Date.now()}`,
              type: 'terminal',
              title: 'Terminal'
            };
            return {
              kuberneterBottomPanelTabs: [defaultTerm],
              kuberneterActiveBottomPanelTabId: defaultTerm.id
            };
          }
          const nextActiveId =
            state.kuberneterActiveBottomPanelTabId === id
              ? remaining[remaining.length - 1].id
              : state.kuberneterActiveBottomPanelTabId;
          return {
            kuberneterBottomPanelTabs: remaining,
            kuberneterActiveBottomPanelTabId: nextActiveId
          };
        }),

      openPodTerminalTab: (podName, namespace, containerName) => {
        if (!podName) return;
        const state = get();
        const tabTitle = containerName ? `Pod: ${podName} (${containerName})` : `Pod: ${podName}`;
        const existing = state.kuberneterBottomPanelTabs.find(
          (t) => t.title === tabTitle && t.type === 'terminal'
        );

        useLayoutStore.getState().openBottomPanelWithTab('terminal');

        if (existing) {
          set({ kuberneterActiveBottomPanelTabId: existing.id });
          return;
        }

        const newId = `term-pod-${podName}-${containerName || 'default'}-${Date.now()}`;
        const nsFlag = namespace ? `-n ${namespace} ` : '';
        const cFlag = containerName ? `-c ${containerName} ` : '';
        const command = `kubectl exec -it ${podName} ${nsFlag}${cFlag}-- sh || kubectl exec -it ${podName} ${nsFlag}${cFlag}-- bash`;

        const newTab: KuberneterBottomPanelTab = {
          id: newId,
          type: 'terminal',
          title: tabTitle,
          initialCommand: command
        };

        set({
          kuberneterBottomPanelTabs: [...state.kuberneterBottomPanelTabs, newTab],
          kuberneterActiveBottomPanelTabId: newId
        });
      },

      openPodLogsTab: (podName, namespace, containerName) => {
        if (!podName) return;
        const state = get();
        const tabTitle = containerName ? `Logs: ${podName} (${containerName})` : `Logs: ${podName}`;
        const existing = state.kuberneterBottomPanelTabs.find(
          (t) => t.title === tabTitle && t.type === 'terminal'
        );

        useLayoutStore.getState().openBottomPanelWithTab('terminal');

        if (existing) {
          set({ kuberneterActiveBottomPanelTabId: existing.id });
          return;
        }

        const newId = `term-logs-${podName}-${containerName || 'default'}-${Date.now()}`;
        const nsFlag = namespace ? `-n ${namespace} ` : '';
        const cFlag = containerName ? `-c ${containerName}` : `--all-containers=true`;
        const command = `kubectl logs -f ${podName} ${nsFlag}${cFlag}`;

        const newTab: KuberneterBottomPanelTab = {
          id: newId,
          type: 'terminal',
          title: tabTitle,
          initialCommand: command
        };

        set({
          kuberneterBottomPanelTabs: [...state.kuberneterBottomPanelTabs, newTab],
          kuberneterActiveBottomPanelTabId: newId
        });
      },

      openResourceEditTab: async (resource, name, namespace, rawItem) => {
        if (!name) return;
        const state = get();
        const tabTitle = `Edit: ${name}`;
        const existing = state.kuberneterBottomPanelTabs.find(
          (t) => t.title === tabTitle && t.type === 'create-resource'
        );

        useLayoutStore.getState().openBottomPanelWithTab('terminal');

        if (existing) {
          set({ kuberneterActiveBottomPanelTabId: existing.id });
          return;
        }

        let yaml = '';
        try {
          const activeInstanceId = useLayoutStore.getState().activeInstanceId;
          const configPath = state.kuberneterInstanceConfigPath[activeInstanceId];
          const cluster = state.kuberneterInstanceCluster[activeInstanceId];
          const res = await window.kuberneter.getResourceYaml(
            configPath,
            cluster,
            resource || 'pod',
            name,
            namespace
          );
          if (res.yaml) {
            yaml = res.yaml;
          }
        } catch (err) {
          console.warn('Failed to fetch live Resource YAML via IPC, falling back to rawItem', err);
        }

        if (!yaml && rawItem) {
          try {
            yaml = jsYaml.dump(rawItem);
          } catch {
            yaml = '';
          }
        }

        const newId = `edit-${resource}-${name}-${Date.now()}`;
        const newTab: KuberneterBottomPanelTab = {
          id: newId,
          type: 'create-resource',
          title: tabTitle,
          initialYaml: yaml
        };

        set({
          kuberneterBottomPanelTabs: [...state.kuberneterBottomPanelTabs, newTab],
          kuberneterActiveBottomPanelTabId: newId
        });
      },

      openPodEditTab: async (podName, namespace, rawItem) => {
        return get().openResourceEditTab('pod', podName, namespace, rawItem);
      },

      openNodeTerminalTab: (nodeName) => {
        if (!nodeName) return;
        const state = get();
        const tabTitle = `Node: ${nodeName}`;
        const existing = state.kuberneterBottomPanelTabs.find(
          (t) => t.title === tabTitle && t.type === 'terminal'
        );

        useLayoutStore.getState().openBottomPanelWithTab('terminal');

        if (existing) {
          set({ kuberneterActiveBottomPanelTabId: existing.id });
          return;
        }

        const newId = `term-node-${nodeName}-${Date.now()}`;
        const command = `kubectl debug node/${nodeName} -it --image=busybox || kubectl node-shell ${nodeName}`;

        const newTab: KuberneterBottomPanelTab = {
          id: newId,
          type: 'terminal',
          title: tabTitle,
          initialCommand: command
        };

        set({
          kuberneterBottomPanelTabs: [...state.kuberneterBottomPanelTabs, newTab],
          kuberneterActiveBottomPanelTabId: newId
        });
      },

      setKuberneterTabDrawerState: (tabId, state) =>
        set((prev) => {
          const current = prev.kuberneterTabDrawers[tabId] || {
            isOpen: false,
            width: 320,
            contentType: null,
            payload: null
          };
          return {
            kuberneterTabDrawers: {
              ...prev.kuberneterTabDrawers,
              [tabId]: { ...current, ...state }
            }
          };
        }),
      kuberneterRecentConnections: [],

      setKuberneterInstanceCluster: (instanceId, cluster) =>
        set((state) => ({
          kuberneterInstanceCluster: { ...state.kuberneterInstanceCluster, [instanceId]: cluster }
        })),

      setKuberneterInstanceServer: (instanceId, server) =>
        set((state) => ({
          kuberneterInstanceServer: { ...state.kuberneterInstanceServer, [instanceId]: server }
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

      setKuberneterInstanceRefreshInterval: (instanceId, interval) =>
        set((state) => ({
          kuberneterInstanceRefreshInterval: {
            ...state.kuberneterInstanceRefreshInterval,
            [instanceId]: interval
          }
        })),

      setKuberneterMetricsConfig: (contextName, patch) =>
        set((state) => ({
          kuberneterMetricsConfig: {
            ...state.kuberneterMetricsConfig,
            [contextName]: {
              ...DEFAULT_METRICS_CONFIG,
              ...state.kuberneterMetricsConfig[contextName],
              ...patch
            }
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

      initInstance: (instanceId, context) =>
        set((state) => ({
          kuberneterInstanceCluster: {
            ...state.kuberneterInstanceCluster,
            [instanceId]: context?.cluster || ''
          },
          kuberneterInstanceServer: {
            ...state.kuberneterInstanceServer,
            [instanceId]: context?.server || ''
          },
          kuberneterInstanceConfigPath: {
            ...state.kuberneterInstanceConfigPath,
            [instanceId]: context?.configPath || ''
          },
          kuberneterInstanceNamespace: {
            ...state.kuberneterInstanceNamespace,
            [instanceId]: context?.namespace || 'All Namespaces'
          },
          kuberneterInstanceResource: {
            ...state.kuberneterInstanceResource,
            [instanceId]: context?.cluster ? 'overview' : 'home'
          },
          kuberneterInstanceRefreshInterval: {
            ...state.kuberneterInstanceRefreshInterval,
            [instanceId]: '60s'
          }
        }))
    }),
    {
      name: 'craftbox-kuberneter-store',
      partialize: (state) => ({
        kuberneterKubeconfigs: state.kuberneterKubeconfigs,
        kuberneterInstanceCluster: state.kuberneterInstanceCluster,
        kuberneterInstanceServer: state.kuberneterInstanceServer,
        kuberneterInstanceNamespace: state.kuberneterInstanceNamespace,
        kuberneterInstanceResource: state.kuberneterInstanceResource,
        kuberneterInstanceConfigPath: state.kuberneterInstanceConfigPath,
        kuberneterInstanceRefreshInterval: state.kuberneterInstanceRefreshInterval,
        kuberneterMetricsConfig: state.kuberneterMetricsConfig,
        kuberneterRecentConnections: state.kuberneterRecentConnections
      })
    }
  )
);
