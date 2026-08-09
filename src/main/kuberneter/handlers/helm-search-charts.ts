import { ipcMain } from 'electron';
import { runHelm, checkHelmInstalled } from '../helm-cli';

export interface HelmRepoItem {
  name: string;
  url: string;
}

export function registerHelmSearchChartsHandler(): void {
  // Search Helm repository charts
  ipcMain.handle('kuberneter:helm-search-charts', async (_, kubeconfigPath?: string) => {
    if (!(await checkHelmInstalled())) return { helmNotFound: true };

    try {
      const stdout = await runHelm(['search', 'repo', '-o', 'json'], kubeconfigPath);
      const parsed = JSON.parse(stdout.trim());

      if (!Array.isArray(parsed)) {
        return { error: 'Unexpected response from helm search repo' };
      }

      if (parsed.length > 0) {
        return parsed;
      }

      // Empty results — check if repos are actually configured
      try {
        const repoStdout = await runHelm(['repo', 'list', '-o', 'json'], kubeconfigPath);
        const repos = JSON.parse(repoStdout.trim());
        if (Array.isArray(repos) && repos.length > 0) {
          // Repos exist but no charts indexed yet — user needs to run helm repo update
          return { noCharts: true, reposCount: repos.length };
        }
      } catch {
        // repo list failed → treat as no repos
      }

      return { noRepos: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes('no repositories') ||
        message.toLowerCase().includes('no repo found')
      ) {
        return { noRepos: true };
      }
      return { error: message };
    }
  });

  // List Helm repositories
  ipcMain.handle('kuberneter:helm-list-repos', async (_, kubeconfigPath?: string) => {
    if (!(await checkHelmInstalled())) return { helmNotFound: true };
    try {
      const stdout = await runHelm(['repo', 'list', '-o', 'json'], kubeconfigPath);
      const parsed = JSON.parse(stdout.trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes('no repositories') ||
        message.toLowerCase().includes('no repo')
      ) {
        return [];
      }
      return { error: message };
    }
  });

  // Add a Helm repository and update index
  ipcMain.handle(
    'kuberneter:helm-add-repo',
    async (_, name: string, url: string, kubeconfigPath?: string) => {
      if (!(await checkHelmInstalled())) return { helmNotFound: true };
      try {
        await runHelm(['repo', 'add', name, url], kubeconfigPath);
        await runHelm(['repo', 'update'], kubeconfigPath);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  // Remove a Helm repository
  ipcMain.handle(
    'kuberneter:helm-remove-repo',
    async (_, name: string, kubeconfigPath?: string) => {
      if (!(await checkHelmInstalled())) return { helmNotFound: true };
      try {
        await runHelm(['repo', 'remove', name], kubeconfigPath);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  // Update/Refresh all Helm repositories
  ipcMain.handle('kuberneter:helm-update-repos', async (_, kubeconfigPath?: string) => {
    if (!(await checkHelmInstalled())) return { helmNotFound: true };
    try {
      const stdout = await runHelm(['repo', 'update'], kubeconfigPath);
      return { success: true, message: stdout };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });
}
