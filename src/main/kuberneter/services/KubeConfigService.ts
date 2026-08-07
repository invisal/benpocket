import { KubeConfig } from '@kubernetes/client-node';

export interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string; // Cluster endpoint URL
  isActive: boolean;
}

export class KubeConfigService {
  /**
   * Loads a KubeConfig instance from a custom file path or default system locations.
   */
  public static loadKubeConfig(kubeconfigPath?: string, contextName?: string): KubeConfig {
    const kc = new KubeConfig();
    if (kubeconfigPath) {
      kc.loadFromFile(kubeconfigPath);
    } else {
      kc.loadFromDefault();
    }

    if (contextName) {
      kc.setCurrentContext(contextName);
    }

    return kc;
  }

  /**
   * Lists all available contexts and endpoints from a kubeconfig file.
   */
  public static listContexts(kubeconfigPath?: string): K8sContext[] {
    const kc = this.loadKubeConfig(kubeconfigPath);
    const contexts = kc.getContexts();
    const currentContext = kc.getCurrentContext();
    const clusters = kc.getClusters();

    const clusterServerMap = new Map<string, string>();
    for (const c of clusters) {
      if (c.name && c.server) {
        clusterServerMap.set(c.name, c.server);
      }
    }

    return contexts.map((ctx) => {
      const name = ctx.name || '';
      const clusterName = ctx.cluster || '';
      return {
        name,
        cluster: clusterName,
        user: ctx.user || '',
        namespace: ctx.namespace || 'default',
        server: clusterServerMap.get(clusterName) || '',
        isActive: name === currentContext
      };
    });
  }
}
