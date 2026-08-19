import { ipcMain } from 'electron';
import { KubeClientService } from '../services/KubeClientService';

export function registerResourcesHandler(): void {
  // Query live cluster resources via @kubernetes/client-node direct REST API
  ipcMain.handle(
    'kuberneter:get-resources',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      resource: string,
      namespace?: string
    ) => {
      const result = await KubeClientService.getResourcesDirect(
        kubeconfigPath,
        contextName,
        resource,
        namespace
      );
      if (!result) {
        return { items: [], error: 'Failed to fetch resources from the cluster API server.' };
      }
      return result;
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
      const result = await KubeClientService.getResourceYamlDirect(
        kubeconfigPath,
        contextName,
        resource,
        name,
        namespace
      );
      if (!result) {
        return { error: 'Failed to fetch resource YAML from the cluster API server.' };
      }
      return result;
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
      const result = await KubeClientService.applyResourceYamlDirect(
        kubeconfigPath,
        contextName,
        yamlContent
      );
      if (!result) {
        return { error: 'Failed to apply resource YAML to the cluster API server.' };
      }
      return result;
    }
  );

  ipcMain.handle(
    'kuberneter:cordon-node',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      nodeName: string,
      unschedulable: boolean
    ) => {
      return KubeClientService.cordonNodeDirect(
        kubeconfigPath,
        contextName,
        nodeName,
        unschedulable
      );
    }
  );

  ipcMain.handle(
    'kuberneter:delete-resource',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      resource: string,
      name: string,
      namespace?: string
    ) => {
      return KubeClientService.deleteResourceDirect(
        kubeconfigPath,
        contextName,
        resource,
        name,
        namespace
      );
    }
  );
}
