import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

export function registerHelmReleaseValuesHandler(): void {
  // Get the values of a Helm release (user-supplied or all computed values)
  ipcMain.handle(
    'kuberneter:helm-get-release-values',
    async (
      _,
      releaseName: string,
      namespace: string,
      allValues?: boolean,
      kubeconfigPath?: string,
      contextName?: string
    ) => {
      try {
        const args = ['get', 'values', releaseName, '-n', namespace, '-o', 'yaml'];
        if (allValues) {
          args.push('-a');
        }
        const stdout = await runHelm(args, kubeconfigPath, contextName);
        return { values: stdout };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}
