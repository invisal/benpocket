import { ipcMain, app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import { resolveKubectlBinaryPath } from './kubectl-settings';
import { startTunnel, stopTunnel, stopAllTunnels } from './tunnels/tunnel-manager';
import type { TunnelProvider } from './tunnels/types';

const activePortForwards = new Map<string, ChildProcess>();

function waitForPortForward(child: ChildProcess, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    let outputLog = '';

    const timer = setTimeout(() => {
      reject(
        new Error(`kubectl port-forward timed out after ${timeoutMs}ms. Output: ${outputLog}`)
      );
    }, timeoutMs);

    const onError = (err: Error) => {
      clearTimeout(timer);
      reject(
        new Error(`KUBECTL_NOT_FOUND: Failed to execute kubectl port-forward (${err.message})`)
      );
    };

    child.on('error', onError);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      outputLog += text;
      if (text.includes('Forwarding from')) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        child.off('error', onError);
        resolve();
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('exit', (code) => {
      clearTimeout(timer);
      child.off('error', onError);
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
        kubectlPath?: string;
        tunnelType?: TunnelProvider;
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
        targetPort,
        kubectlPath,
        tunnelType = 'none'
      } = params;

      // Kill any existing process running for the same ID
      if (activePortForwards.has(id)) {
        const oldProc = activePortForwards.get(id);
        if (oldProc && !oldProc.killed) {
          oldProc.kill('SIGTERM');
        }
        activePortForwards.delete(id);
      }
      await stopTunnel(id);

      try {
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

        const pfArgs: string[] = [
          'port-forward',
          '--address',
          '127.0.0.1',
          resourceTarget,
          `${localPort}:${targetPort}`,
          '-n',
          namespace
        ];

        if (contextName) {
          pfArgs.push('--context', contextName);
        }

        const env: NodeJS.ProcessEnv = { ...process.env };
        if (kubeconfigPath && kubeconfigPath !== 'default') {
          env.KUBECONFIG = kubeconfigPath;
          pfArgs.push('--kubeconfig', kubeconfigPath);
        }

        const kubectlBin = await resolveKubectlBinaryPath(kubectlPath);
        const child = spawn(kubectlBin, pfArgs, { shell: false, env });

        // Wait until kubectl port-forward outputs "Forwarding from"
        await waitForPortForward(child);

        activePortForwards.set(id, child);

        child.on('exit', () => {
          activePortForwards.delete(id);
          void stopTunnel(id);
        });

        // If public tunnel requested, start tunnel on top of the local port forward
        if (tunnelType && tunnelType !== 'none') {
          const tunnelResult = await startTunnel({
            id,
            provider: tunnelType,
            localPort
          });

          if (!tunnelResult.success) {
            // Terminate kubectl if tunnel failed
            if (!child.killed) {
              child.kill('SIGTERM');
            }
            activePortForwards.delete(id);
            return { error: tunnelResult.error || `Failed to establish ${tunnelType} tunnel` };
          }

          return {
            success: true,
            publicUrl: tunnelResult.publicUrl,
            tunnelType: tunnelResult.provider
          };
        }

        return { success: true, tunnelType: 'none' };
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
      await stopTunnel(id);
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
    void stopAllTunnels();
  });
}
