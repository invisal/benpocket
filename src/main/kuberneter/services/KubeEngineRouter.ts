import { KubeClientService } from './KubeClientService';
import { KubeCliService } from './KubeCliService';
import { getKubeApiConfig } from '../k8s-cli';

export class KubeEngineRouter {
  /**
   * Routes resource requests through Direct API (KubeClientService) first,
   * with automatic fallback to CLI (KubeCliService).
   */
  public static async getResources(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      // 1. Extract API Server endpoint and credentials from kubeconfig
      const apiConfig = await getKubeApiConfig(kubeconfigPath, contextName);

      // 2. Attempt Direct Kube API fetch
      const directResult = await KubeClientService.getResourcesDirect(
        kubeconfigPath,
        contextName,
        resource,
        namespace,
        apiConfig
      );

      if (directResult && !directResult.error) {
        return directResult;
      }
    } catch {
      // Direct API failed or unavailable, fallback to CLI
    }

    // 3. Fallback to KubeCliService (kubectl CLI)
    return KubeCliService.getResources(kubeconfigPath, contextName, resource, namespace);
  }
}
