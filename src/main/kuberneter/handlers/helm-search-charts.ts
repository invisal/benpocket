import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

export function registerHelmSearchChartsHandler(): void {
  // Search Helm repository charts
  ipcMain.handle('kuberneter:helm-search-charts', async (_, kubeconfigPath?: string) => {
    try {
      const stdout = await runHelm(['search', 'repo', '-o', 'json'], kubeconfigPath);
      return JSON.parse(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });
}
