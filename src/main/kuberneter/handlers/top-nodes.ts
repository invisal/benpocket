import { ipcMain } from 'electron';
import { KubeClientService } from '../services/KubeClientService';

export function registerTopNodesHandler(): void {
  ipcMain.removeHandler('kuberneter:get-top-nodes');

  // Query live node metrics via @kubernetes/client-node Metrics API
  ipcMain.handle(
    'kuberneter:get-top-nodes',
    async (_, kubeconfigPath: string | undefined, contextName: string | undefined) => {
      const result = await KubeClientService.getMetricsDirect(kubeconfigPath, contextName, 'nodes');

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
          metadata?: { name?: string };
          usage?: { cpu?: string; memory?: string };
        };
        return {
          name: item.metadata?.name || 'unknown',
          cpu: item.usage?.cpu || '0m',
          cpuPct: 'N/A',
          memory: item.usage?.memory || '0Mi',
          memoryPct: 'N/A'
        };
      });

      return { items };
    }
  );
}
