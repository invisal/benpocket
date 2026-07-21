import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

export function registerHelmListReleasesHandler(): void {
  // List Helm releases
  ipcMain.handle(
    'kuberneter:helm-list-releases',
    async (_, kubeconfigPath?: string, contextName?: string) => {
      try {
        const stdout = await runHelm(['list', '-A', '-o', 'json'], kubeconfigPath, contextName);
        return JSON.parse(stdout);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
