import { ipcMain } from 'electron';
import { KubeEngineRouter } from '../services/KubeEngineRouter';

export function registerTopNodesHandler(): void {
  ipcMain.removeHandler('kuberneter:get-top-nodes');

  // Query live node metrics via engine router (Direct REST API -> kubectl fallback)
  ipcMain.handle(
    'kuberneter:get-top-nodes',
    (_, kubeconfigPath: string | undefined, contextName: string | undefined) =>
      KubeEngineRouter.getTopNodes(kubeconfigPath, contextName)
  );
}
