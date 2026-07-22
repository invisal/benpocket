import { ipcMain, app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';

const activePortForwards = new Map<string, ChildProcess>();

function waitForPortForward(child: ChildProcess, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    let outputLog = '';

    const timer = setTimeout(() => {
      reject(
        new Error(`kubectl port-forward timed out after ${timeoutMs}ms. Output: ${outputLog}`)
      );
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      outputLog += text;
      if (text.includes('Forwarding from')) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        resolve();
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(outputLog.trim() || `kubectl port-forward exited early with code ${code}`));
    });
  });
}

export function registerPortForwardHandler(): void {
  ipcMain.handle(
    'kuberneter:start-port-forward',
    async (
      _,
      params: {
        id: string;
        kubeconfigPath?: string;
        contextName?: string;
        namespace: string;
        resourceKind: string;
        resourceName: string;
        localPort: number;
        targetPort: number;
      }
    ) => {
      const {
        id,
        kubeconfigPath,
        contextName,
        namespace,
        resourceKind,
        resourceName,
        localPort,
        targetPort
      } = params;

      // Kill any existing process running for the same ID
      if (activePortForwards.has(id)) {
        const oldProc = activePortForwards.get(id);
        if (oldProc && !oldProc.killed) {
          oldProc.kill('SIGTERM');
        }
        activePortForwards.delete(id);
      }

      try {
        const pfArgs: string[] = [];
        if (kubeconfigPath && kubeconfigPath !== 'default') {
          pfArgs.push('--kubeconfig', kubeconfigPath);
        }
        if (contextName) {
          pfArgs.push('--context', contextName);
        }

        const normalizedKind = resourceKind.toLowerCase();
        let resourceTarget = `${normalizedKind}/${resourceName}`;
        if (normalizedKind === 'pod' || normalizedKind === 'pods') {
          resourceTarget = `pod/${resourceName}`;
        } else if (
          normalizedKind === 'service' ||
          normalizedKind === 'services' ||
          normalizedKind === 'svc'
        ) {
          resourceTarget = `svc/${resourceName}`;
        } else if (
          normalizedKind === 'deployment' ||
          normalizedKind === 'deployments' ||
          normalizedKind === 'deploy'
        ) {
          resourceTarget = `deploy/${resourceName}`;
        }

        pfArgs.push('port-forward', resourceTarget, `${localPort}:${targetPort}`, '-n', namespace);

        const child = spawn('kubectl', pfArgs, { shell: true });

        // Wait until kubectl port-forward outputs "Forwarding from"
        await waitForPortForward(child);

        activePortForwards.set(id, child);

        child.on('exit', () => {
          activePortForwards.delete(id);
        });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  ipcMain.handle('kuberneter:stop-port-forward', async (_, id: string) => {
    try {
      const proc = activePortForwards.get(id);
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
        activePortForwards.delete(id);
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  app.on('will-quit', () => {
    for (const proc of activePortForwards.values()) {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    }
    activePortForwards.clear();
  });
}
