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

export interface KuberneterApi {
  listContexts: (kubeconfigPath?: string) => Promise<ListContextsResponse>;
  selectKubeconfigFile: () => Promise<string | null>;
  saveKubeconfig: (content: string, filename: string) => Promise<string | { error: string }>;
  getResources: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ) => Promise<GetResourcesResponse>;
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
  helmSearchCharts: (kubeconfigPath?: string) => Promise<HelmChartItem[] | { error: string }>;
  helmGetChartVersions: (
    chartName: string,
    kubeconfigPath?: string
  ) => Promise<HelmChartVersion[] | { error: string }>;
  helmGetChartDetails: (
    chartName: string,
    version?: string,
    kubeconfigPath?: string
  ) => Promise<HelmChartDetails | { error: string }>;
  helmInstallChart: (
    releaseName: string,
    chartName: string,
    version: string,
    namespace: string,
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<{ result?: string; error?: string }>;
  helmGetChartIcons: () => Promise<Record<string, string>>;
  helmListReleases: (
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<HelmReleaseItem[] | { error: string }>;
  helmGetReleaseValues: (
    releaseName: string,
    namespace: string,
    allValues?: boolean,
    kubeconfigPath?: string,
    contextName?: string
  ) => Promise<{ values: string } | { error: string }>;
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
  selectKubeconfigFile: () => ipcRenderer.invoke('kuberneter:select-kubeconfig-file'),
  saveKubeconfig: (content, filename) =>
    ipcRenderer.invoke('kuberneter:save-kubeconfig', content, filename),
  getResources: (kubeconfigPath, contextName, resource, namespace) =>
    ipcRenderer.invoke(
      'kuberneter:get-resources',
      kubeconfigPath,
      contextName,
      resource,
      namespace
    ),
  getTopNodes: (kubeconfigPath, contextName) =>
    ipcRenderer.invoke('kuberneter:get-top-nodes', kubeconfigPath, contextName),
  getTopPods: (kubeconfigPath, contextName, namespace) =>
    ipcRenderer.invoke('kuberneter:get-top-pods', kubeconfigPath, contextName, namespace),
  helmSearchCharts: (kubeconfigPath) =>
    ipcRenderer.invoke('kuberneter:helm-search-charts', kubeconfigPath),
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
    )
};
