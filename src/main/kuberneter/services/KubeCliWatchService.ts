import { spawn, type ChildProcess } from 'child_process';

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

export class KubeCliWatchService {
  /**
   * Spawns a background `kubectl get <resource> --watch -o json` child process
   * and invokes the onEvent callback whenever a streamed JSON event is received.
   */
  public static startWatchProcess(
    id: string,
    options: WatchOptions,
    onEvent: (event: WatchEvent) => void
  ): ChildProcess {
    const args: string[] = [];
    if (options.contextName) {
      args.push('--context', options.contextName);
    }

    args.push('get', options.resource);

    const isClusterScoped = [
      'nodes',
      'namespaces',
      'clusterroles',
      'clusterrolebindings',
      'storageclasses',
      'persistentvolumes',
      'pvs'
    ].includes(options.resource.toLowerCase());

    if (!isClusterScoped) {
      if (options.namespace && options.namespace !== 'All Namespaces') {
        args.push('-n', options.namespace);
      } else {
        args.push('-A');
      }
    }

    args.push('--watch', '-o', 'json');

    const kubeArgs = options.kubeconfigPath
      ? ['--kubeconfig', options.kubeconfigPath, ...args]
      : args;

    console.log(
      `[KubeCliWatchService] Spawning watch process for ${id}: kubectl ${kubeArgs.join(' ')}`
    );
    const child = spawn('kubectl', kubeArgs, { shell: true });

    let buffer = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');

      // Top-level brace tracking to extract complete JSON objects from stream
      let braceCount = 0;
      let objectStart = -1;

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (char === '{') {
          if (braceCount === 0) {
            objectStart = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && objectStart !== -1) {
            const jsonStr = buffer.substring(objectStart, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);

              // Ignore initial snapshot List object (e.g. PodList, DeploymentList)
              if (parsed && parsed.kind && parsed.kind.endsWith('List')) {
                buffer = buffer.substring(i + 1);
                i = -1;
                objectStart = -1;
                braceCount = 0;
                continue;
              }

              if (parsed && (parsed.type || parsed.kind)) {
                const eventType = (parsed.type as 'ADDED' | 'MODIFIED' | 'DELETED') || 'MODIFIED';
                onEvent({
                  id,
                  resource: options.resource,
                  type: eventType,
                  object: parsed.object
                });
              }
            } catch (e) {
              console.warn('[KubeCliWatchService] Failed to parse stream object:', e);
            }

            buffer = buffer.substring(i + 1);
            i = -1;
            objectStart = -1;
            braceCount = 0;
          }
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      console.warn(`[KubeCliWatchService] stderr [${id}]:`, chunk.toString('utf8'));
    });

    child.on('error', (err) => {
      console.warn(`[KubeCliWatchService] Watch process error for ${id}:`, err);
    });

    return child;
  }
}
