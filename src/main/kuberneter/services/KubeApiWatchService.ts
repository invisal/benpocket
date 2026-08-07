import { Watch } from '@kubernetes/client-node';
import { KubeConfigService } from './KubeConfigService';
import { buildKubeApiPath } from '../constants/k8sResources';

export interface WatchOptions {
  kubeconfigPath?: string;
  contextName?: string;
  resource: string;
  namespace?: string;
}

export interface WatchEvent {
  id: string;
  resource: string;
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object?: unknown;
}

/**
 * Manages real-time watch streams against the Kubernetes API server using
 * @kubernetes/client-node's Watch class (v1.x fetch-based implementation).
 * watch.watch() returns an AbortController — call controller.abort() to stop.
 */
export class KubeApiWatchService {
  /**
   * Starts a watch stream for the given resource.
   * Returns an { abort } handle backed by the AbortController from watch.watch().
   */
  public static startWatch(
    id: string,
    options: WatchOptions,
    onEvent: (event: WatchEvent) => void
  ): { abort: () => void } {
    let aborted = false;
    let controller: AbortController | null = null;

    const run = async (): Promise<void> => {
      try {
        const kc = KubeConfigService.loadKubeConfig(options.kubeconfigPath, options.contextName);
        const watch = new Watch(kc);

        const namespace =
          options.namespace && options.namespace !== 'All Namespaces'
            ? options.namespace
            : undefined;
        const path = buildKubeApiPath(options.resource, namespace);

        console.log(`[KubeApiWatchService] Starting watch for ${id}: ${path}`);

        // watch.watch() in @kubernetes/client-node v1.x returns an AbortController
        const ctrl = await watch.watch(
          path,
          {},
          (type: string, obj: unknown) => {
            if (aborted) return;
            const eventType = (type as 'ADDED' | 'MODIFIED' | 'DELETED') || 'MODIFIED';
            onEvent({ id, resource: options.resource, type: eventType, object: obj });
          },
          (err: unknown) => {
            if (!aborted && err) {
              console.warn(`[KubeApiWatchService] Watch stream ended for ${id}:`, err);
            }
          }
        );

        controller = ctrl as unknown as AbortController;

        // If abort was requested before the watch connected, abort immediately.
        if (aborted) {
          controller.abort();
        }
      } catch (err) {
        if (!aborted) {
          console.warn(`[KubeApiWatchService] Failed to start watch for ${id}:`, err);
        }
      }
    };

    void run();

    return {
      abort: () => {
        aborted = true;
        controller?.abort();
      }
    };
  }
}
