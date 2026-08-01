import { spawn } from 'child_process';

/**
 * Runs a kubectl command with arguments and optional custom kubeconfig path.
 */
export function runKubectl(args: string[], kubeconfigPath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const kubeArgs = kubeconfigPath ? ['--kubeconfig', kubeconfigPath, ...args] : args;

    const child = spawn('kubectl', kubeArgs, { shell: true });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      if (code !== 0) {
        try {
          const firstBrace = stdout.indexOf('{');
          const lastBrace = stdout.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            const jsonCandidate = stdout.substring(firstBrace, lastBrace + 1);
            JSON.parse(jsonCandidate);
            resolve(jsonCandidate);
            return;
          }
        } catch {
          // ignore parsing error, proceed to reject
        }
        reject(new Error(stderr.trim() || stdout.trim() || `kubectl exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Runs a kubectl command with stdin input and optional custom kubeconfig path.
 */
export function runKubectlWithInput(
  args: string[],
  input: string,
  kubeconfigPath?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const kubeArgs = kubeconfigPath ? ['--kubeconfig', kubeconfigPath, ...args] : args;
    const child = spawn('kubectl', kubeArgs, { shell: true });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `kubectl exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      reject(err);
    });

    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
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

import { KubeConfigService } from './services/KubeConfigService';

/**
 * Lists contexts and endpoints from a kubeconfig file using @kubernetes/client-node with kubectl fallback.
 */
export async function listKubeconfigContexts(kubeconfigPath?: string): Promise<K8sContext[]> {
  try {
    return KubeConfigService.listContexts(kubeconfigPath);
  } catch (err) {
    console.warn('[k8s-cli] KubeConfigService listContexts failed, falling back to kubectl:', err);
  }

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

    interface KubeconfigContext {
      name: string;
      context?: {
        cluster?: string;
        user?: string;
        namespace?: string;
      };
    }

    return contexts.map((ctx: KubeconfigContext) => {
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
  } catch (err) {
    console.error('Error listing contexts:', err);
    throw err;
  }
}
