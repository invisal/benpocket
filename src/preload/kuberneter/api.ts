import { ipcRenderer } from 'electron';

export interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string;
  isActive: boolean;
}

export type ListContextsResponse = K8sContext[] | { error: string };

export interface GetResourcesResponse {
  items?: unknown[];
  error?: string;
}

export interface PrometheusQueryConfig {
  kubeconfigPath?: string;
  contextName?: string;
  provider?: string;
  filterEmptyContainers?: boolean;
  useHttps?: boolean;
  pathPrefix?: string;
  kubectlPath?: string;
}

export interface WatchOptions {
  kubeconfigPath?: string;
  contextName?: string;
  resource: string;
  namespace?: string;
}

export interface WatchEvent {
  id: string;
  resource: string;
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object?: unknown;
}

export interface TerminalSpawnOptions {
  kubeconfigPath?: string;
  contextName?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
}

export interface HelmCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  isSystemPath?: boolean;
  error?: string;
}

export interface KubectlCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface LocalKubeconfig {
  path: string;
  name: string;
  isDefault?: boolean;
}

export interface KuberneterApi {
  listContexts: (kubeconfigPath?: string) => Promise<ListContextsResponse>;
  detectLocalKubeconfigs: () => Promise<LocalKubeconfig[]>;
  selectKubeconfigFile: () => Promise<string | null>;
  saveKubeconfig: (content: string, filename: string) => Promise<string | { error: string }>;
  readKubeconfigFile: (
    filePath: string
  ) => Promise<{ name?: string; content?: string; error?: string }>;
  syncCloudKubeconfig: (
    id: string,
    name: string,
    content: string
  ) => Promise<string | { error: string }>;
  getResources: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ) => Promise<GetResourcesResponse>;
  getResourceYaml: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    name: string,
    namespace?: string
  ) => Promise<{ yaml?: string; error?: string }>;
  applyResourceYaml: (
    yamlContent: string,
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<{ result?: string; error?: string; yaml?: string }>;
  startWatch: (id: string, options: WatchOptions) => Promise<{ success?: boolean; error?: string }>;
  stopWatch: (id: string) => Promise<{ success?: boolean; error?: string }>;
  onWatchEvent: (callback: (event: WatchEvent) => void) => () => void;
  getTopNodes: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined
  ) => Promise<{
    items?: { name: string; cpu: string; cpuPct: string; memory: string; memoryPct: string }[];
    error?: string;
  }>;
  getTopPods: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    namespace?: string
  ) => Promise<{
    items?: { namespace: string; name: string; cpu: string; memory: string }[];
    error?: string;
  }>;
  queryPrometheus: (config: PrometheusQueryConfig) => Promise<{
    items?: { namespace: string; name: string; cpu: string; memory: string }[];
    source?: string;
    error?: string;
  }>;
  queryPrometheusInstantPods: (config: PrometheusQueryConfig) => Promise<{
    items?: { namespace: string; name: string; cpu: string; memory: string }[];
    error?: string;
  }>;
  testPrometheus: (config: PrometheusQueryConfig) => Promise<{
    ok: boolean;
    latencyMs: number;
    source?: string;
    error?: string;
  }>;
  clearPrometheusCache: (kubeconfigPath?: string, contextName?: string) => Promise<{ ok: boolean }>;
  helmSearchCharts: (
    kubeconfigPath?: string
  ) => Promise<
    | HelmChartItem[]
    | { error: string }
    | { helmNotFound: true }
    | { noRepos: true }
    | { noCharts: true; reposCount: number }
  >;
  helmListRepos: (
    kubeconfigPath?: string
  ) => Promise<HelmRepoItem[] | { error: string } | { helmNotFound: true }>;
  helmAddRepo: (
    name: string,
    url: string,
    kubeconfigPath?: string
  ) => Promise<{ success?: boolean; error?: string } | { helmNotFound: true }>;
  helmRemoveRepo: (
    name: string,
    kubeconfigPath?: string
  ) => Promise<{ success?: boolean; error?: string } | { helmNotFound: true }>;
  helmUpdateRepos: (
    kubeconfigPath?: string
  ) => Promise<{ success?: boolean; message?: string; error?: string } | { helmNotFound: true }>;
  helmGetChartVersions: (
    chartName: string,
    kubeconfigPath?: string
  ) => Promise<HelmChartVersion[] | { error: string } | { helmNotFound: true }>;
  helmGetChartDetails: (
    chartName: string,
    version?: string,
    kubeconfigPath?: string
  ) => Promise<HelmChartDetails | { error: string } | { helmNotFound: true }>;
  helmInstallChart: (
    releaseName: string,
    chartName: string,
    version: string,
    namespace: string,
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<{ result?: string; error?: string } | { helmNotFound: true }>;
  helmGetChartIcons: () => Promise<Record<string, string>>;
  helmListReleases: (
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<HelmReleaseItem[] | { error: string } | { helmNotFound: true }>;
  helmGetReleaseValues: (
    releaseName: string,
    namespace: string,
    allValues?: boolean,
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<{ values: string } | { error: string } | { helmNotFound: true }>;
  checkKubectl: (customPath?: string) => Promise<KubectlCheckResult>;
  selectKubectlFile: () => Promise<string | null>;
  checkHelm: (customPath?: string) => Promise<HelmCheckResult>;
  selectHelmFile: () => Promise<string | null>;
  startPortForward: (params: {
    id: string;
    kubeconfigPath?: string;
    contextName?: string;
    namespace: string;
    resourceKind: string;
    resourceName: string;
    localPort: number;
    targetPort: number;
    kubectlPath?: string;
  }) => Promise<{ success?: boolean; error?: string }>;
  stopPortForward: (id: string) => Promise<{ success?: boolean; error?: string }>;
  queryPodMetricsRange: (
    params: PrometheusQueryConfig & {
      namespace: string;
      podName: string;
      timeRange?: '1h' | '6h' | '24h';
    }
  ) => Promise<{
    source?: string;
    timeLabels: string[];
    cpu: { usage: number[]; requests: number[]; limits: number[] };
    memory: { usage: number[]; requests: number[]; limits: number[] };
    network: { rx: number[]; tx: number[] };
    filesystem: { usage: number[]; limit: number[] };
    error?: string;
  }>;
  queryNodeMetricsRange: (
    params: PrometheusQueryConfig & {
      nodeName: string;
      timeRange?: '1h' | '6h' | '24h';
    }
  ) => Promise<{
    source?: string;
    timeLabels: string[];
    cpu: {
      usage: number[];
      workloadUsage?: number[];
      requests: number[];
      limits: number[];
      allocatable?: number[];
      capacity?: number[];
    };
    memory: {
      usage: number[];
      workloadUsage?: number[];
      requests: number[];
      limits: number[];
      allocatable?: number[];
      capacity?: number[];
    };
    network: { rx: number[]; tx: number[] };
    filesystem: { usage: number[]; limit: number[] };
    error?: string;
  }>;
  /** Cordon or uncordon a Node in the cluster. */
  cordonNode: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    nodeName: string,
    unschedulable: boolean
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  /** Deletes a Kubernetes resource from the cluster. */
  deleteResource: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    name: string,
    namespace?: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Spawn a PTY-backed shell session for the given terminal id. */
  terminalCreate: (
    id: string,
    options: TerminalSpawnOptions
  ) => Promise<{ success?: boolean; error?: string }>;
  /** Send keystrokes / pasted text to a terminal session. */
  terminalInput: (id: string, data: string) => void;
  /** Inform the PTY of a new viewport size (columns x rows). */
  terminalResize: (id: string, cols: number, rows: number) => void;
  /** Kill a terminal session and release its resources. */
  terminalDispose: (id: string) => Promise<{ success?: boolean; error?: string }>;
  /** Subscribe to PTY output for a session. Returns an unsubscribe fn. */
  onTerminalData: (id: string, callback: (data: string) => void) => () => void;
  /** Subscribe to PTY exit for a session. Returns an unsubscribe fn. */
  onTerminalExit: (id: string, callback: (exitCode: number, signal?: number) => void) => () => void;
}

export interface HelmRepoItem {
  name: string;
  url: string;
}

export interface HelmChartItem {
  name: string;
  version: string;
  app_version: string;
  description: string;
}

export interface HelmChartVersion {
  name: string;
  version: string;
  app_version: string;
  description: string;
}

export interface HelmChartMaintainer {
  name?: string;
  email?: string;
  url?: string;
}

export interface HelmChartDetails {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  home: string;
  icon: string;
  keywords: string[];
  maintainers: HelmChartMaintainer[];
  error?: string;
}

export interface HelmReleaseItem {
  name: string;
  namespace: string;
  revision: string;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
}

export const kuberneterApi: KuberneterApi = {
  listContexts: (kubeconfigPath) => ipcRenderer.invoke('kuberneter:list-contexts', kubeconfigPath),
  detectLocalKubeconfigs: () => ipcRenderer.invoke('kuberneter:detect-local-kubeconfigs'),
  selectKubeconfigFile: () => ipcRenderer.invoke('kuberneter:select-kubeconfig-file'),
  saveKubeconfig: (content, filename) =>
    ipcRenderer.invoke('kuberneter:save-kubeconfig', content, filename),
  readKubeconfigFile: (filePath) => ipcRenderer.invoke('kuberneter:read-kubeconfig-file', filePath),
  syncCloudKubeconfig: (id, name, content) =>
    ipcRenderer.invoke('kuberneter:sync-cloud-kubeconfig', id, name, content),
  getResources: (kubeconfigPath, contextName, resource, namespace) =>
    ipcRenderer.invoke(
      'kuberneter:get-resources',
      kubeconfigPath,
      contextName,
      resource,
      namespace
    ),
  getResourceYaml: (kubeconfigPath, contextName, resource, name, namespace) =>
    ipcRenderer.invoke(
      'kuberneter:get-resource-yaml',
      kubeconfigPath,
      contextName,
      resource,
      name,
      namespace
    ),
  applyResourceYaml: (yamlContent, kubeconfigPath, contextName) =>
    ipcRenderer.invoke('kuberneter:apply-resource-yaml', yamlContent, kubeconfigPath, contextName),
  startWatch: (id, options) => ipcRenderer.invoke('kuberneter:start-watch', id, options),
  stopWatch: (id) => ipcRenderer.invoke('kuberneter:stop-watch', id),
  onWatchEvent: (callback) => {
    const subscription = (_: unknown, event: WatchEvent) => callback(event);
    ipcRenderer.on('kuberneter:watch-event', subscription);
    return () => {
      ipcRenderer.removeListener('kuberneter:watch-event', subscription);
    };
  },
  getTopNodes: (kubeconfigPath, contextName) =>
    ipcRenderer.invoke('kuberneter:get-top-nodes', kubeconfigPath, contextName),
  getTopPods: (kubeconfigPath, contextName, namespace) =>
    ipcRenderer.invoke('kuberneter:get-top-pods', kubeconfigPath, contextName, namespace),
  queryPrometheus: (config) => ipcRenderer.invoke('kuberneter:query-prometheus', config),
  queryPrometheusInstantPods: (config) =>
    ipcRenderer.invoke('kuberneter:query-prometheus-instant-pods', config),
  testPrometheus: (config) => ipcRenderer.invoke('kuberneter:test-prometheus', config),
  clearPrometheusCache: (kubeconfigPath, contextName) =>
    ipcRenderer.invoke('kuberneter:clear-prometheus-cache', kubeconfigPath, contextName),
  helmSearchCharts: (kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-search-charts', kubeconfigPath),
  helmListRepos: (kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-list-repos', kubeconfigPath),
  helmAddRepo: (name, url, kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-add-repo', name, url, kubeconfigPath),
  helmRemoveRepo: (name, kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-remove-repo', name, kubeconfigPath),
  helmUpdateRepos: (kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-update-repos', kubeconfigPath),
  helmGetChartVersions: (chartName, kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-get-chart-versions', chartName, kubeconfigPath),
  helmGetChartDetails: (chartName, version, kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-get-chart-details', chartName, version, kubeconfigPath),
  helmInstallChart: (releaseName, chartName, version, namespace, kubeconfigPath, contextName) =>
    ipcRenderer.invoke(
      'kuberneter:helm-install-chart',
      releaseName,
      chartName,
      version,
      namespace,
      kubeconfigPath,
      contextName
    ),
  helmGetChartIcons: () => ipcRenderer.invoke('kuberneter:helm-get-chart-icons'),
  helmListReleases: (kubeconfigPath, contextName) =>
    ipcRenderer.invoke('kuberneter:helm-list-releases', kubeconfigPath, contextName),
  helmGetReleaseValues: (releaseName, namespace, allValues, kubeconfigPath, contextName) =>
    ipcRenderer.invoke(
      'kuberneter:helm-get-release-values',
      releaseName,
      namespace,
      allValues,
      kubeconfigPath,
      contextName
    ),
  checkKubectl: (customPath) => ipcRenderer.invoke('kuberneter:check-kubectl', customPath),
  selectKubectlFile: () => ipcRenderer.invoke('kuberneter:select-kubectl-file'),
  checkHelm: (customPath) => ipcRenderer.invoke('kuberneter:check-helm', customPath),
  selectHelmFile: () => ipcRenderer.invoke('kuberneter:select-kubectl-file'),
  startPortForward: (params) => ipcRenderer.invoke('kuberneter:start-port-forward', params),
  stopPortForward: (id) => ipcRenderer.invoke('kuberneter:stop-port-forward', id),
  queryPodMetricsRange: (params) =>
    ipcRenderer.invoke('kuberneter:query-pod-metrics-range', params),
  queryNodeMetricsRange: (params) =>
    ipcRenderer.invoke('kuberneter:query-node-metrics-range', params),
  cordonNode: (kubeconfigPath, contextName, nodeName, unschedulable) =>
    ipcRenderer.invoke(
      'kuberneter:cordon-node',
      kubeconfigPath,
      contextName,
      nodeName,
      unschedulable
    ),
  deleteResource: (kubeconfigPath, contextName, resource, name, namespace) =>
    ipcRenderer.invoke(
      'kuberneter:delete-resource',
      kubeconfigPath,
      contextName,
      resource,
      name,
      namespace
    ),
  terminalCreate: (id, options) => ipcRenderer.invoke('kuberneter:terminal-create', id, options),
  terminalInput: (id, data) => ipcRenderer.send('kuberneter:terminal-input', id, data),
  terminalResize: (id, cols, rows) =>
    ipcRenderer.send('kuberneter:terminal-resize', id, cols, rows),
  terminalDispose: (id) => ipcRenderer.invoke('kuberneter:terminal-dispose', id),
  onTerminalData: (id, callback) => {
    const subscription = (_: unknown, eventId: string, data: string) => {
      if (eventId === id) callback(data);
    };
    ipcRenderer.on('kuberneter:terminal-data', subscription);
    return () => {
      ipcRenderer.removeListener('kuberneter:terminal-data', subscription);
    };
  },
  onTerminalExit: (id, callback) => {
    const subscription = (_: unknown, eventId: string, exitCode: number, signal?: number) => {
      if (eventId === id) callback(exitCode, signal);
    };
    ipcRenderer.on('kuberneter:terminal-exit', subscription);
    return () => {
      ipcRenderer.removeListener('kuberneter:terminal-exit', subscription);
    };
  }
};
