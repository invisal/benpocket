import { ipcRenderer } from 'electron';

export interface KuberneterApi {
  listContexts: (kubeconfigPath?: string) => Promise<any>;
  selectKubeconfigFile: () => Promise<string | null>;
  saveKubeconfig: (content: string, filename: string) => Promise<string | { error: string }>;
  getResources: (
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ) => Promise<any>;
}

export const kuberneterApi: KuberneterApi = {
  listContexts: (kubeconfigPath) => ipcRenderer.invoke('kuberneter:list-contexts', kubeconfigPath),
  selectKubeconfigFile: () => ipcRenderer.invoke('kuberneter:select-kubeconfig-file'),
  saveKubeconfig: (content, filename) =>
    ipcRenderer.invoke('kuberneter:save-kubeconfig', content, filename),
  getResources: (kubeconfigPath, contextName, resource, namespace) =>
    ipcRenderer.invoke('kuberneter:get-resources', kubeconfigPath, contextName, resource, namespace)
};
