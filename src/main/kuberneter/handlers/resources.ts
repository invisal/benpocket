import { ipcMain } from 'electron';
import { runKubectl } from '../k8s-cli';

export function registerResourcesHandler(): void {
  // Query live cluster resources (Pods, Deployments, Services, ConfigMaps, etc.)
  ipcMain.handle(
    'kuberneter:get-resources',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      resource: string,
      namespace?: string
    ) => {
      try {
        const resolvedKubeconfig = kubeconfigPath || undefined;

        // Build CLI args
        const args = [];
        if (contextName) {
          args.push('--context', contextName);
        }

        args.push('get', resource);

        // Namespace scoping (only apply if the resource is namespaced)
        const isClusterScoped = [
          'nodes',
          'namespaces',
          'clusterroles',
          'clusterrolebindings',
          'storageclasses',
          'persistentvolumes',
          'pvs'
        ].includes(resource.toLowerCase());

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
  );
}
