import { runKubectl } from '../k8s-cli';
import { isClusterScopedResource } from '../constants/k8sResources';

export class KubeCliService {
  /**
   * Fetches cluster resources using kubectl get <resource> -o json
   */
  public static async getResources(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      const resolvedKubeconfig = kubeconfigPath || undefined;

      const args: string[] = [];
      if (contextName) {
        args.push('--context', contextName);
      }

      args.push('get', resource);

      const isClusterScoped = isClusterScopedResource(resource);

      if (!isClusterScoped) {
        if (namespace && namespace !== 'All Namespaces') {
          args.push('-n', namespace);
        } else {
          args.push('-A');
        }
      }

      args.push('-o', 'json');

      const stdout = await runKubectl(args, resolvedKubeconfig);
      const firstBrace = stdout.indexOf('{');
      const lastBrace = stdout.lastIndexOf('}');
      let jsonStr = stdout;
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        jsonStr = stdout.substring(firstBrace, lastBrace + 1);
      }
      const data = JSON.parse(jsonStr);

      return { items: data.items || [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
}
