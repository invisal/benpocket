import { ipcMain } from 'electron';
import { runKubectl } from '../k8s-cli';

export function registerTopPodsHandler(): void {
  // Query live pod metrics (CPU & Memory usage)
  ipcMain.handle(
    'kuberneter:get-top-pods',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      namespace?: string
    ) => {
      try {
        const resolvedKubeconfig = kubeconfigPath || undefined;
        const args = [];
        if (contextName) {
          args.push('--context', contextName);
        }
        args.push('top', 'pods');
        if (namespace && namespace !== 'All Namespaces') {
          args.push('-n', namespace);
        } else {
          args.push('-A');
        }
        args.push('--no-headers');

        let stdout: string;
        try {
          stdout = await runKubectl(args, resolvedKubeconfig);
        } catch {
          // Metrics API not available - return empty items so UI shows N/A
          return { items: [] };
        }

        const lines = stdout.trim().split('\n');
        const items = lines
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            const parts = trimmed.split(/\s+/);
            const isAllNamespaces = !namespace || namespace === 'All Namespaces';
            if (isAllNamespaces && parts.length >= 4) {
              return {
                namespace: parts[0],
                name: parts[1],
                cpu: parts[2],
                memory: parts[3]
              };
            } else if (!isAllNamespaces && parts.length >= 3) {
              return {
                namespace: namespace,
                name: parts[0],
                cpu: parts[1],
                memory: parts[2]
              };
            }
            return null;
          })
          .filter(Boolean);

        return { items };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
