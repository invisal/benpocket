import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { findHelmBinaryPath } from '../helm-cli';

export interface HelmCheckResult {
  available: boolean;
  path: string;
  version?: string;
  isSystemPath: boolean;
  error?: string;
}

export function registerHelmSettingsHandlers(): void {
  ipcMain.handle(
    'kuberneter:check-helm',
    async (_event, customPath?: string): Promise<HelmCheckResult> => {
      try {
        const { path: resolvedPath, isSystemPath } = await findHelmBinaryPath(customPath);

        return new Promise<HelmCheckResult>((resolve) => {
          execFile(resolvedPath, ['version', '--short'], (err, stdout, stderr) => {
            if (err) {
              resolve({
                available: false,
                path: resolvedPath,
                isSystemPath,
                error: stderr.trim() || err.message || 'Helm executable not found'
              });
              return;
            }

            const version = stdout.trim() || 'Installed';
            resolve({
              available: true,
              path: resolvedPath,
              version,
              isSystemPath
            });
          });
        });
      } catch (err) {
        return {
          available: false,
          path: customPath || 'helm',
          isSystemPath: true,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
  );
}
