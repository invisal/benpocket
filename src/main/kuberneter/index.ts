import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { runKubectl, listKubeconfigContexts } from './k8s-cli';

export function registerKuberneterHandlers(): void {
  // 1. List contexts of a given kubeconfig path (or default)
  ipcMain.handle('kuberneter:list-contexts', async (_, kubeconfigPath?: string) => {
    try {
      const resolvedPath = kubeconfigPath || undefined;
      return await listKubeconfigContexts(resolvedPath);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 2. Select and load local kubeconfig file via OS file dialog
  ipcMain.handle('kuberneter:select-kubeconfig-file', async (event) => {
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
    } catch (err: any) {
      return { error: err.message };
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
        const isClusterScoped = ['nodes', 'namespaces', 'clusterroles', 'storageclasses'].includes(
          resource.toLowerCase()
        );

        if (!isClusterScoped) {
          if (namespace && namespace !== 'All Namespaces') {
            args.push('-n', namespace);
          } else {
            args.push('-A');
          }
        }

        args.push('-o', 'json');

        const stdout = await runKubectl(args, resolvedKubeconfig);
        const data = JSON.parse(stdout);

        return { items: data.items || [] };
      } catch (err: any) {
        return { error: err.message };
      }
    }
  );
}
