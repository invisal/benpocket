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
    ipcRenderer.invoke('kuberneter:get-top-pods', kubeconfigPath, contextName, namespace)
};
