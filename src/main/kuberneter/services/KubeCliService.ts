import { runKubectl, runKubectlWithInput } from '../k8s-cli';
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

  public static async getResourceYaml(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    name: string,
    namespace?: string
  ): Promise<{ yaml?: string; error?: string }> {
    try {
      const args = ['get', resource, name, '-o', 'yaml'];
      if (contextName) args.unshift('--context', contextName);
      if (namespace && namespace !== 'All Namespaces') args.push('-n', namespace);
      const yaml = await runKubectl(args, kubeconfigPath);
      return { yaml };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  public static async applyResourceYaml(
    kubeconfigPath: string | undefined,
    contextName: string | undefined,
    yamlContent: string
  ): Promise<{ result?: string; error?: string }> {
    try {
      const args = ['apply', '--server-side', '--field-manager=benPocket', '-f', '-'];
      if (contextName) args.unshift('--context', contextName);
      const result = await runKubectlWithInput(args, yamlContent, kubeconfigPath);
      return { result };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
