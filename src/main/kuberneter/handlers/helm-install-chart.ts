import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

export function registerHelmInstallChartHandler(): void {
  // Install a Helm chart
  ipcMain.handle(
    'kuberneter:helm-install-chart',
    async (
      _,
      releaseName: string,
      chartName: string,
      version: string,
      namespace: string,
      kubeconfigPath?: string,
      contextName?: string
    ) => {
      try {
        const args = ['install', releaseName, chartName, '--version', version, '-n', namespace];
        const stdout = await runHelm(args, kubeconfigPath, contextName);
        return { result: stdout };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
