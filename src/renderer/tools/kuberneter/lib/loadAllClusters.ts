export interface AvailableCluster {
  name: string;
  configPath: string;
}

/**
 * Loads unique Kubernetes contexts across user-added Kubeconfig paths.
 */
export async function loadAllClusters(kubeconfigs: string[]): Promise<AvailableCluster[]> {
  const results: AvailableCluster[] = [];

  for (const path of kubeconfigs) {
    try {
      const contexts = await window.kuberneter.listContexts(path);
      if (contexts && Array.isArray(contexts)) {
        for (const ctx of contexts) {
          if (ctx && ctx.name) {
            if (!results.some((r) => r.name === ctx.name)) {
              results.push({
                name: ctx.name,
                configPath: path
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error loading contexts for ${path}:`, err);
    }
  }

  return results;
}
