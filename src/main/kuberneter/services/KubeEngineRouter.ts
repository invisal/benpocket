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
}
