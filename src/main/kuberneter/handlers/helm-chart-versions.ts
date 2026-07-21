import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

export function registerHelmChartVersionsHandler(): void {
  // Get all versions of a Helm chart
  ipcMain.handle(
    'kuberneter:helm-get-chart-versions',
    async (_, chartName: string, kubeconfigPath?: string) => {
      try {
        const stdout = await runHelm(
          ['search', 'repo', chartName, '-l', '-o', 'json'],
          kubeconfigPath
        );
        return JSON.parse(stdout);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
