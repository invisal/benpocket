import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

  setKuberneterInstanceCluster: (instanceId: string, cluster: string) => void;
  setKuberneterInstanceServer: (instanceId: string, server: string) => void;
  setKuberneterInstanceNamespace: (instanceId: string, ns: string) => void;
  setKuberneterInstanceResource: (instanceId: string, resource: string) => void;
  setKuberneterInstanceConfigPath: (instanceId: string, path: string) => void;
  setKuberneterInstanceRefreshInterval: (instanceId: string, interval: string) => void;
  setKuberneterMetricsConfig: (contextName: string, config: Partial<MetricsConfig>) => void;

  setKuberneterTabDrawerState: (tabId: string, state: Partial<DrawerState>) => void;

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
    (set) => ({
      kuberneterInstanceCluster: {},
      kuberneterInstanceServer: {},
      kuberneterInstanceNamespace: {},
      kuberneterInstanceResource: {},
      kuberneterInstanceConfigPath: {},
      kuberneterInstanceRefreshInterval: {},
      kuberneterMetricsConfig: {},
      kuberneterKubeconfigs: [],
      kuberneterTabDrawers: {},

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
