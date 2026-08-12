import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as jsYaml from 'js-yaml';
import { useLayoutStore } from '@renderer/store/layout.store';
import type { MetricCategory, MetricsSource, PrometheusProvider } from '../lib/metricsProviders';
import type { KuberneterToastItem } from '../components/shared/KuberneterToast';

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
  refreshInterval: number;
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
  hiddenMetrics: [],
  refreshInterval: 3
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
  /** Configured custom path for kubectl binary (empty string defaults to system PATH / probing). */
  kuberneterKubectlPath: string;
  /** Configured custom path for helm binary (empty string defaults to system PATH / probing). */
  kuberneterHelmPath: string;

  kuberneterToasts: KuberneterToastItem[];
  addToast: (toast: Omit<KuberneterToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  showKubectlMissingToast: (customMessage?: string) => void;
  showHelmMissingToast: (customMessage?: string) => void;
  showHelmNoReposToast: (customMessage?: string) => void;

  kuberneterKubeconfigs: string[];
  kuberneterRecentConnections: RecentConnection[];
  kuberneterTabDrawers: Record<string, DrawerState>;
  kuberneterInstanceSidebarOpen: Record<string, boolean>;

  toggleKuberneterInstanceSidebar: (instanceId: string) => void;
  setKuberneterInstanceSidebarOpen: (instanceId: string, isOpen: boolean) => void;

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
  setKuberneterKubectlPath: (path: string) => void;
  setKuberneterHelmPath: (path: string) => void;

  setKuberneterTabDrawerState: (tabId: string, state: Partial<DrawerState>) => void;

  setKuberneterBottomPanelTabs: (tabs: KuberneterBottomPanelTab[]) => void;
  setKuberneterActiveBottomPanelTabId: (id: string) => void;
  addKuberneterBottomPanelTab: (tab: KuberneterBottomPanelTab) => void;
  closeKuberneterBottomPanelTab: (id: string) => void;
  openPodTerminalTab: (podName: string, namespace?: string, containerName?: string) => void;
  openPodLogsTab: (podName: string, namespace?: string, containerName?: string) => void;
  openPodEditTab: (podName: string, namespace?: string, rawItem?: unknown) => Promise<void>;
  openNodeEditTab: (nodeName: string, rawItem?: unknown) => Promise<void>;
  openResourceEditTab: (
    resource: string,
    name: string,
    namespace?: string,
    rawItem?: unknown
  ) => Promise<void>;
  openNodeTerminalTab: (nodeName: string) => void;

  addKuberneterKubeconfig: (filePath: string) => void;
  removeKuberneterKubeconfig: (filePath: string) => void;
  setKuberneterKubeconfigs: (filePaths: string[]) => void;
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
      kuberneterRecentConnections: [],
      kuberneterTabDrawers: {},
      kuberneterInstanceSidebarOpen: {},

      toggleKuberneterInstanceSidebar: (instanceId) =>
        set((state) => ({
          kuberneterInstanceSidebarOpen: {
            ...state.kuberneterInstanceSidebarOpen,
            [instanceId]: !(state.kuberneterInstanceSidebarOpen[instanceId] ?? true)
          }
        })),
      setKuberneterInstanceSidebarOpen: (instanceId, isOpen) =>
        set((state) => ({
          kuberneterInstanceSidebarOpen: {
            ...state.kuberneterInstanceSidebarOpen,
            [instanceId]: isOpen
          }
        })),

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

        window.kuberneter.checkKubectl(state.kuberneterKubectlPath).then((res) => {
          if (!res.available) {
            get().showKubectlMissingToast(
              'Pod Terminal Exec requires the kubectl CLI executable. Please configure kubectl in Settings.'
            );
          }
        });

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

        window.kuberneter.checkKubectl(state.kuberneterKubectlPath).then((res) => {
          if (!res.available) {
            get().showKubectlMissingToast(
              'Pod Logs Tailing requires the kubectl CLI executable. Please configure kubectl in Settings.'
            );
          }
        });

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

      openNodeEditTab: async (nodeName, rawItem) => {
        return get().openResourceEditTab('node', nodeName, undefined, rawItem);
      },

      openNodeTerminalTab: (nodeName) => {
        if (!nodeName) return;
        const state = get();

        window.kuberneter.checkKubectl(state.kuberneterKubectlPath).then((res) => {
          if (!res.available) {
            get().showKubectlMissingToast(
              'Node Shell Debugging requires the kubectl CLI executable. Please configure kubectl in Settings.'
            );
          }
        });
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

      kuberneterKubectlPath: '',
      setKuberneterKubectlPath: (path) => set({ kuberneterKubectlPath: path }),

      kuberneterHelmPath: '',
      setKuberneterHelmPath: (path) => set({ kuberneterHelmPath: path }),

      kuberneterToasts: [],
      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newItem: KuberneterToastItem = { ...toast, id };
        set((state) => ({ kuberneterToasts: [...state.kuberneterToasts, newItem] }));
        return id;
      },
      removeToast: (id) => {
        set((state) => ({
          kuberneterToasts: state.kuberneterToasts.filter((t) => t.id !== id)
        }));
      },
      showKubectlMissingToast: (customMessage) => {
        const state = get();
        if (state.kuberneterToasts.some((t) => t.title.includes('kubectl'))) {
          return;
        }
        state.addToast({
          type: 'warning',
          title: 'kubectl Executable Required',
          message:
            customMessage ||
            'The kubectl CLI executable was not found on your system $PATH or configured location. Please configure it in Settings.',
          actions: [
            {
              label: 'Go to Settings',
              variant: 'primary',
              onClick: () => {
                const activeInstanceId = useLayoutStore.getState().activeInstanceId;
                useKuberneterStore
                  .getState()
                  .setKuberneterInstanceResource(activeInstanceId, 'settings');
                useLayoutStore.getState().openTab({
                  id: `kuberneter-k8s-settings-${activeInstanceId}`,
                  title: 'Settings',
                  type: 'kuberneter',
                  instanceId: activeInstanceId,
                  meta: { resource: 'settings' }
                });
              }
            }
          ]
        });
      },
      showHelmMissingToast: (customMessage) => {
        const state = get();
        if (state.kuberneterToasts.some((t) => t.title.toLowerCase().includes('helm'))) {
          return;
        }
        state.addToast({
          type: 'warning',
          title: 'Helm Executable Required',
          message:
            customMessage ||
            'The Helm CLI executable was not found on your system $PATH or configured location. Please configure Helm in Settings.',
          actions: [
            {
              label: 'Go to Settings',
              variant: 'primary',
              onClick: () => {
                const activeInstanceId = useLayoutStore.getState().activeInstanceId;
                useKuberneterStore
                  .getState()
                  .setKuberneterInstanceResource(activeInstanceId, 'settings');
                useLayoutStore.getState().openTab({
                  id: `kuberneter-k8s-settings-${activeInstanceId}`,
                  title: 'Settings',
                  type: 'kuberneter',
                  instanceId: activeInstanceId,
                  meta: { resource: 'settings' }
                });
              }
            }
          ]
        });
      },
      showHelmNoReposToast: (customMessage) => {
        const state = get();
        if (state.kuberneterToasts.some((t) => t.title.toLowerCase().includes('repositories'))) {
          return;
        }
        state.addToast({
          type: 'warning',
          title: 'No Helm Repositories Configured',
          message:
            customMessage ||
            'You need to add at least one Helm chart repository to search and browse charts. Configure repositories in Settings.',
          actions: [
            {
              label: 'Go to Settings',
              variant: 'primary',
              onClick: () => {
                const activeInstanceId = useLayoutStore.getState().activeInstanceId;
                useKuberneterStore
                  .getState()
                  .setKuberneterInstanceResource(activeInstanceId, 'settings');
                useLayoutStore.getState().openTab({
                  id: `kuberneter-k8s-settings-${activeInstanceId}`,
                  title: 'Settings',
                  type: 'kuberneter',
                  instanceId: activeInstanceId,
                  meta: { resource: 'settings' }
                });
              }
            }
          ]
        });
      },

      addKuberneterKubeconfig: (filePath) =>
        set((state) => {
          if (state.kuberneterKubeconfigs.includes(filePath)) return state;
          return { kuberneterKubeconfigs: [...state.kuberneterKubeconfigs, filePath] };
        }),

      removeKuberneterKubeconfig: (filePath) =>
        set((state) => ({
          kuberneterKubeconfigs: state.kuberneterKubeconfigs.filter((p) => p !== filePath)
        })),

      setKuberneterKubeconfigs: (filePaths) => set({ kuberneterKubeconfigs: filePaths }),

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
        kuberneterKubectlPath: state.kuberneterKubectlPath,
        kuberneterHelmPath: state.kuberneterHelmPath,
        kuberneterRecentConnections: state.kuberneterRecentConnections
      })
    }
  )
);
