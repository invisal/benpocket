import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { listKubeconfigContexts } from '../k8s-cli';

export function registerKubeconfigHandlers(): void {
  // List contexts of a given kubeconfig path (or default)
  ipcMain.handle('kuberneter:list-contexts', async (_, kubeconfigPath?: string) => {
    try {
      const resolvedPath = kubeconfigPath || undefined;
      return await listKubeconfigContexts(resolvedPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // Select and load local kubeconfig file via OS file dialog
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

  // Save pasted configuration content to appData/kubeconfigs directory
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
}
