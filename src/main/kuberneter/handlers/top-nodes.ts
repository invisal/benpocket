import { ipcMain } from 'electron';
import { runKubectl } from '../k8s-cli';

export function registerTopNodesHandler(): void {
  // Query live node metrics (CPU & Memory usage)
  ipcMain.handle(
    'kuberneter:get-top-nodes',
    async (_, kubeconfigPath: string | undefined, contextName: string | undefined) => {
      try {
        const resolvedKubeconfig = kubeconfigPath || undefined;
        const args = [];
        if (contextName) {
          args.push('--context', contextName);
        }
        args.push('top', 'nodes', '--no-headers');

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
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              return {
                name: parts[0],
                cpu: parts[1],
                cpuPct: parts[2],
                memory: parts[3],
                memoryPct: parts[4]
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
