import { ipcMain, app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { KubeConfigService } from '../services/KubeConfigService';

export function registerKubeconfigHandlers(): void {
  // List contexts of a given kubeconfig path (or default)
  ipcMain.handle('kuberneter:list-contexts', async (_, kubeconfigPath?: string) => {
    try {
      const resolvedPath = kubeconfigPath || undefined;
      return KubeConfigService.listContexts(resolvedPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // Detect ambient and local kubeconfig files on host machine
  ipcMain.handle('kuberneter:detect-local-kubeconfigs', async () => {
    try {
      return KubeConfigService.detectLocalKubeconfigs();
    } catch (err) {
      console.warn('Failed to detect local kubeconfigs:', err);
      return [];
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

  // Read content of a local kubeconfig file
  ipcMain.handle('kuberneter:read-kubeconfig-file', async (_, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { error: `File does not exist: ${filePath}` };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const name = path.basename(filePath);
      return { name, content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // Sync/cache cloud kubeconfig content to local userData/kubeconfigs directory
  ipcMain.handle(
    'kuberneter:sync-cloud-kubeconfig',
    async (_, id: string, name: string, content: string) => {
      try {
        const userDataDir = app.getPath('userData');
        const kubeconfigsDir = path.join(userDataDir, 'kubeconfigs');

        if (!fs.existsSync(kubeconfigsDir)) {
          fs.mkdirSync(kubeconfigsDir, { recursive: true });
        }

        const safeId = (id || name || `config-${Date.now()}`).replace(/[^a-zA-Z0-9-_.]/g, '_');
        const fileName =
          safeId.endsWith('.yaml') || safeId.endsWith('.yml') ? safeId : `${safeId}.yaml`;
        const filePath = path.join(kubeconfigsDir, fileName);

        if (fs.existsSync(filePath)) {
          const existing = fs.readFileSync(filePath, 'utf8');
          if (existing === content) {
            return filePath;
          }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
