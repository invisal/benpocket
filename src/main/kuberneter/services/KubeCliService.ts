import { runKubectl, runKubectlWithInput } from '../k8s-cli';
import { isClusterScopedResource } from '../constants/k8sResources';
import { normalizeCpuString, normalizeMemoryString } from '../utils/metricsNormalizer';
import * as jsYaml from 'js-yaml';

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
  ): Promise<{ result?: string; error?: string; yaml?: string }> {
    try {
      let cleanYaml = yamlContent;
      try {
        const doc = jsYaml.load(yamlContent) as Record<string, unknown>;
        if (doc && typeof doc === 'object') {
          if (doc.metadata && typeof doc.metadata === 'object') {
            const meta = doc.metadata as Record<string, unknown>;
            delete meta.resourceVersion;
            delete meta.uid;
            delete meta.creationTimestamp;
            delete meta.generation;
            delete meta.managedFields;
            delete meta.selfLink;
          }
          delete doc.status;
          cleanYaml = jsYaml.dump(doc);
        }
      } catch {
        // If YAML parsing fails, proceed with original content
      }

      const args = ['apply', '--server-side', '--field-manager=benPocket', '-f', '-'];
      if (contextName) args.unshift('--context', contextName);
      const result = await runKubectlWithInput(args, cleanYaml, kubeconfigPath);
      return { result };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  public static async getTopNodes(
    kubeconfigPath?: string,
    contextName?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
      const args = [];
      if (contextName) {
        args.push('--context', contextName);
      }
      args.push('top', 'nodes', '--no-headers');

      const stdout = await runKubectl(args, kubeconfigPath);
      const lines = stdout.trim().split('\n');
      const items = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('W0') || trimmed.startsWith('Warning:')) return null;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 5) {
            return {
              name: parts[0],
              cpu: normalizeCpuString(parts[1]),
              cpuPct: parts[2],
              memory: normalizeMemoryString(parts[3]),
              memoryPct: parts[4]
            };
          } else if (parts.length >= 3) {
            return {
              name: parts[0],
              cpu: normalizeCpuString(parts[1]),
              cpuPct: 'N/A',
              memory: normalizeMemoryString(parts[2]),
              memoryPct: 'N/A'
            };
          }
          return null;
        })
        .filter(Boolean);

      return { items };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { items: [], error: message };
    }
  }

  public static async getTopPods(
    kubeconfigPath?: string,
    contextName?: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string }> {
    try {
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

      const stdout = await runKubectl(args, kubeconfigPath);
      const lines = stdout.trim().split('\n');
      const items = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('W0') || trimmed.startsWith('Warning:')) return null;
          const parts = trimmed.split(/\s+/);
          const isAllNamespaces = !namespace || namespace === 'All Namespaces';
          if (isAllNamespaces && parts.length >= 4) {
            return {
              namespace: parts[0],
              name: parts[1],
              cpu: normalizeCpuString(parts[2]),
              memory: normalizeMemoryString(parts[3])
            };
          } else if (!isAllNamespaces && parts.length >= 3) {
            return {
              namespace: namespace || 'default',
              name: parts[0],
              cpu: normalizeCpuString(parts[1]),
              memory: normalizeMemoryString(parts[2])
            };
          }
          return null;
        })
        .filter(Boolean);

      return { items };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { items: [], error: message };
    }
  }
}
