import { KubeClientService } from './KubeClientService';
import { KubeCliService } from './KubeCliService';

export class KubeEngineRouter {
  /**
   * Routes resource requests through Direct API (KubeClientService backed by @kubernetes/client-node) first,
   * with automatic fallback to CLI (KubeCliService).
   */
  public static async getResources(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      // 1. Attempt Direct Kube API fetch via @kubernetes/client-node
      const directResult = await KubeClientService.getResourcesDirect(
        kubeconfigPath,
        contextName,
        resource,
        namespace
      );

      if (directResult && !directResult.error) {
        return directResult;
      }
    } catch (err) {
      console.warn('[KubeEngineRouter] Direct API error, falling back to CLI:', err);
    }

    // 2. Fallback to KubeCliService (kubectl CLI)
    return KubeCliService.getResources(kubeconfigPath, contextName, resource, namespace);
  }

  public static async getResourceYaml(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    name: string,
    namespace?: string
  ): Promise<{ yaml?: string; error?: string }> {
    try {
      const directResult = await KubeClientService.getResourceYamlDirect(
        kubeconfigPath,
        contextName,
        resource,
        name,
        namespace
      );

      if (directResult && !directResult.error && directResult.yaml) {
        return directResult;
      }
    } catch (err) {
      console.warn(
        '[KubeEngineRouter] Direct API getResourceYaml error, falling back to CLI:',
        err
      );
    }

    return KubeCliService.getResourceYaml(kubeconfigPath, contextName, resource, name, namespace);
  }

  public static async applyResourceYaml(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    yamlContent: string
  ): Promise<{ result?: string; error?: string; yaml?: string }> {
    try {
      const directResult = await KubeClientService.applyResourceYamlDirect(
        kubeconfigPath,
        contextName,
        yamlContent
      );

      if (directResult && !directResult.error) {
        return directResult;
      }
    } catch (err) {
      console.warn(
        '[KubeEngineRouter] Direct API applyResourceYaml error, falling back to CLI:',
        err
      );
    }

    return KubeCliService.applyResourceYaml(kubeconfigPath, contextName, yamlContent);
  }

  public static async getTopNodes(
    kubeconfigPath: string | undefined,
    contextName: string | undefined
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      const directResult = await KubeClientService.getMetricsDirect(
        kubeconfigPath,
        contextName,
        'nodes'
      );

      if (directResult && Array.isArray(directResult.items) && directResult.items.length > 0) {
        const items = directResult.items.map((rawItem: unknown) => {
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
    } catch (err) {
      console.warn('[KubeEngineRouter] Direct API getTopNodes error, falling back to CLI:', err);
    }

    return KubeCliService.getTopNodes(kubeconfigPath, contextName);
  }

  public static async getTopPods(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      const subPath =
        namespace && namespace !== 'All Namespaces' ? `namespaces/${namespace}/pods` : 'pods';
      const directResult = await KubeClientService.getMetricsDirect(
        kubeconfigPath,
        contextName,
        subPath
      );

      if (directResult && Array.isArray(directResult.items) && directResult.items.length > 0) {
        const items = directResult.items.map((rawItem: unknown) => {
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
    } catch (err) {
      console.warn('[KubeEngineRouter] Direct API getTopPods error, falling back to CLI:', err);
    }

    return KubeCliService.getTopPods(kubeconfigPath, contextName, namespace);
  }
}
