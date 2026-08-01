import { ipcMain } from 'electron';
import { KubeEngineRouter } from '../services/KubeEngineRouter';

export function registerResourcesHandler(): void {
  // Query live cluster resources through the Hybrid Engine Router
  ipcMain.handle(
    'kuberneter:get-resources',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      resource: string,
      namespace?: string
    ) => {
      return KubeEngineRouter.getResources(kubeconfigPath, contextName, resource, namespace);
    }
  );

  ipcMain.handle(
    'kuberneter:get-resource-yaml',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      resource: string,
      name: string,
      namespace?: string
    ) => {
      return KubeEngineRouter.getResourceYaml(
        kubeconfigPath,
        contextName,
        resource,
        name,
        namespace
      );
    }
  );

  ipcMain.handle(
    'kuberneter:apply-resource-yaml',
    async (
      _,
      yamlContent: string,
      kubeconfigPath: string | undefined,
      contextName: string | undefined
    ) => {
      return KubeEngineRouter.applyResourceYaml(kubeconfigPath, contextName, yamlContent);
    }
  );
}
