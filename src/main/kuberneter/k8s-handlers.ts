import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { runKubectl, listKubeconfigContexts } from './k8s-cli';

export function registerK8sHandlers(): void {
  // 1. List contexts of a given kubeconfig path (or default)
  ipcMain.handle('kuberneter:list-contexts', async (_, kubeconfigPath?: string) => {
    try {
      const resolvedPath = kubeconfigPath || undefined;
      return await listKubeconfigContexts(resolvedPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // 2. Select and load local kubeconfig file via OS file dialog
  ipcMain.handle('kuberneter:select-kubeconfig-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Kubeconfig', extensions: ['*', 'yaml', 'yml', 'conf'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 3. Save pasted configuration content to appData/kubeconfigs directory
  ipcMain.handle('kuberneter:save-kubeconfig', async (_, content: string, filename: string) => {
    try {
      const userDataDir = app.getPath('userData');
      const kubeconfigsDir = path.join(userDataDir, 'kubeconfigs');

      if (!fs.existsSync(kubeconfigsDir)) {
        fs.mkdirSync(kubeconfigsDir, { recursive: true });
      }

      // Clean filename (remove special chars/spaces)
      const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, '') || `config-${Date.now()}`;
      const filePath = path.join(kubeconfigsDir, `${safeName}.yaml`);

      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // 4. Query live cluster resources (Pods, Deployments, Services, ConfigMaps, etc.)
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

  // 5. Query live node metrics (CPU & Memory usage)
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

        const stdout = await runKubectl(args, resolvedKubeconfig);
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

  // 6. Query live pod metrics (CPU & Memory usage)
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

        const stdout = await runKubectl(args, resolvedKubeconfig);
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
