import { exec } from 'child_process';

/**
 * Runs a kubectl command with arguments and optional custom kubeconfig path.
 */
export function runKubectl(args: string[], kubeconfigPath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Standard command: kubectl [args]
    const kubeArgs = kubeconfigPath ? ['--kubeconfig', kubeconfigPath, ...args] : args;
    const cmd = `kubectl ${kubeArgs.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string; // Cluster endpoint URL
  isActive: boolean;
}

/**
 * Lists contexts and endpoints from a kubeconfig file by running config view.
 */
export async function listKubeconfigContexts(kubeconfigPath?: string): Promise<K8sContext[]> {
  try {
    const rawJson = await runKubectl(['config', 'view', '-o', 'json'], kubeconfigPath);
    const config = JSON.parse(rawJson);

    const contexts = config.contexts || [];
    const clusters = config.clusters || [];
    const currentContext = config['current-context'] || '';

    // Create a map of cluster name to API server endpoint
    const clusterServerMap = new Map<string, string>();
    for (const c of clusters) {
      if (c.name && c.cluster?.server) {
        clusterServerMap.set(c.name, c.cluster.server);
      }
    }

    return contexts.map((ctx: any) => {
      const name = ctx.name || '';
      const contextData = ctx.context || {};
      const clusterName = contextData.cluster || '';
      return {
        name,
        cluster: clusterName,
        user: contextData.user || '',
        namespace: contextData.namespace || 'default',
        server: clusterServerMap.get(clusterName) || '',
        isActive: name === currentContext
      };
    });
  } catch (err: any) {
    console.error('Error listing contexts:', err);
    throw err;
  }
}
