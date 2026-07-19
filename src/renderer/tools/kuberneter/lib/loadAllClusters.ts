export interface AvailableCluster {
  name: string;
  configPath: string;
  server?: string;
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
                configPath: path,
                server: ctx.server
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

export function getClusterShortName(name: string): string {
  if (!name) return '';
  const parts = name.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }
  return name.slice(0, 4).toUpperCase();
}

/**
 * Resolves the tooltip title and 4-letter short code for a Kuberneter tab.
 */
export function getTabTitleAndShortName(
  tab: { id: string; type: string; title?: string; payload?: unknown },
  kuberneterInstanceCluster: Record<string, string>,
  kuberneterInstanceServer: Record<string, string>,
  kuberneterRecentConnections: Array<{ contextName: string; server?: string }>
): { title: string; shortName: string } {
  if (tab.type !== 'kuberneter') return { title: tab.title || 'Tool', shortName: '' };

  const instanceId = (tab.payload as { instanceId?: string })?.instanceId || tab.id;
  const clusterName = kuberneterInstanceCluster[instanceId] || '';
  const serverUrl =
    kuberneterInstanceServer[instanceId] ||
    kuberneterRecentConnections.find((c) => c.contextName === clusterName)?.server ||
    '';

  const shortName = getClusterShortName(clusterName);

  const title = clusterName ? `${clusterName}${serverUrl ? `\n${serverUrl}` : ''}` : 'Kuberneter';

  return { title, shortName };
}
