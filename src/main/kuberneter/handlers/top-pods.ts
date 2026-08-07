import { ipcMain } from 'electron';
import { KubeEngineRouter } from '../services/KubeEngineRouter';

export function registerTopPodsHandler(): void {
  ipcMain.removeHandler('kuberneter:get-top-pods');

  // Query live pod metrics via engine router (Direct REST API -> kubectl fallback)
  ipcMain.handle(
    'kuberneter:get-top-pods',
    (_, kubeconfigPath: string | undefined, contextName: string | undefined, namespace?: string) =>
      KubeEngineRouter.getTopPods(kubeconfigPath, contextName, namespace)
  );
}
