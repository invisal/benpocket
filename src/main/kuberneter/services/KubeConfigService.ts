import { KubeConfig } from '@kubernetes/client-node';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string; // Cluster endpoint URL
  isActive: boolean;
}

export interface LocalKubeconfig {
  path: string;
  name: string;
  isDefault?: boolean;
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

  /**
   * Scans the local machine for ambient and standard kubeconfig files.
   * Checks $KUBECONFIG env variable, default ~/.kube/config, and ~/.kube/ directory.
   */
  public static detectLocalKubeconfigs(): LocalKubeconfig[] {
    const foundConfigs: LocalKubeconfig[] = [];
    const seenPaths = new Set<string>();

    const addCandidate = (filePath: string, customName?: string, isDefault = false): boolean => {
      try {
        const resolved = path.resolve(filePath);
        if (seenPaths.has(resolved)) return false;
        if (!fs.existsSync(resolved)) return false;
        const stat = fs.statSync(resolved);
        if (!stat.isFile()) return false;

        const kc = new KubeConfig();
        kc.loadFromFile(resolved);
        if (kc.getContexts().length === 0 && kc.getClusters().length === 0) {
          return false;
        }

        seenPaths.add(resolved);
        foundConfigs.push({
          path: resolved,
          name: customName || path.basename(resolved),
          isDefault
        });
        return true;
      } catch {
        return false;
      }
    };

    // 1. Check KUBECONFIG environment variable
    if (process.env.KUBECONFIG) {
      const paths = process.env.KUBECONFIG.split(path.delimiter);
      for (const p of paths) {
        const trimmed = p.trim();
        if (trimmed) {
          addCandidate(trimmed, path.basename(trimmed), true);
        }
      }
    }

    // 2. Check standard default ~/.kube/config
    const defaultKubePath = path.join(os.homedir(), '.kube', 'config');
    addCandidate(defaultKubePath, 'config (~/.kube/config)', true);

    // 3. Scan ~/.kube directory for other potential kubeconfig files
    const kubeDir = path.join(os.homedir(), '.kube');
    if (fs.existsSync(kubeDir) && fs.statSync(kubeDir).isDirectory()) {
      try {
        const entries = fs.readdirSync(kubeDir);
        const skippedNames = new Set(['cache', 'http-cache', 'schema', '.DS_Store']);

        for (const entry of entries) {
          if (entry.startsWith('.') || skippedNames.has(entry)) continue;

          const fullPath = path.join(kubeDir, entry);
          const stat = fs.statSync(fullPath);

          if (stat.isFile()) {
            const ext = path.extname(entry).toLowerCase();
            const isKubeFile =
              ['.yaml', '.yml', '.conf', '.config', '.kubeconfig'].includes(ext) ||
              entry.startsWith('config');
            if (isKubeFile) {
              addCandidate(fullPath, entry);
            }
          } else if (stat.isDirectory() && ['configs', 'config.d'].includes(entry)) {
            // Scan subfolder (1 level)
            try {
              const subEntries = fs.readdirSync(fullPath);
              for (const subEntry of subEntries) {
                if (subEntry.startsWith('.')) continue;
                const subPath = path.join(fullPath, subEntry);
                if (fs.existsSync(subPath) && fs.statSync(subPath).isFile()) {
                  addCandidate(subPath, `${entry}/${subEntry}`);
                }
              }
            } catch {
              // Ignore unreadable subdirectories
            }
          }
        }
      } catch {
        // Ignore errors reading kube directory
      }
    }

    return foundConfigs;
  }
}
