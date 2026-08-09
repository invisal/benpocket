import { ipcMain } from 'electron';
import { KubeClientService } from '../services/KubeClientService';

export function registerTopPodsHandler(): void {
  ipcMain.removeHandler('kuberneter:get-top-pods');

  // Query live pod metrics via @kubernetes/client-node Metrics API
  ipcMain.handle(
    'kuberneter:get-top-pods',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      namespace?: string
    ) => {
      const subPath =
        namespace && namespace !== 'All Namespaces' ? `namespaces/${namespace}/pods` : 'pods';

      const result = await KubeClientService.getMetricsDirect(kubeconfigPath, contextName, subPath);

      if (!result || !Array.isArray(result.items) || result.items.length === 0) {
        return {
          items: [],
          error:
            result?.error ||
            'Metrics API unavailable. Ensure metrics-server is installed in your cluster.'
        };
      }

      const items = result.items.map((rawItem: unknown) => {
        const item = (rawItem || {}) as {
          metadata?: { name?: string; namespace?: string };
          usage?: { cpu?: string; memory?: string };
        };
        return {
          namespace: item.metadata?.namespace || namespace || 'default',
          name: item.metadata?.name || 'unknown',
          cpu: item.usage?.cpu || '0m',
          memory: item.usage?.memory || '0Mi'
        };
      });

      return { items };
    }
  );
}
