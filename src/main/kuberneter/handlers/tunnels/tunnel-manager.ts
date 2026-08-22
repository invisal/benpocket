import { spawn, type ChildProcess } from 'child_process';
import { extractCloudflareTunnelUrl, extractNgrokTunnelUrl } from './tunnel-parser';
import type { StartTunnelParams, TunnelProvider, TunnelResult } from './types';

interface ActiveTunnelEntry {
  proc: ChildProcess;
  provider: TunnelProvider;
  publicUrl?: string;
}

const activeTunnels = new Map<string, ActiveTunnelEntry>();

/**
 * Waits for a tunnel process to output its public URL within a timeout period.
 */
function waitForTunnelUrl(
  child: ChildProcess,
  provider: 'cloudflare' | 'ngrok',
  timeoutMs = 25000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let outputLog = '';

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `${provider} tunnel timed out after ${Math.round(timeoutMs / 1000)}s. Output:\n${outputLog.trim()}`
        )
      );
    }, timeoutMs);

    const onError = (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === 'ENOENT') {
        if (provider === 'cloudflare') {
          reject(
            new Error(
              "CLOUDFLARED_NOT_FOUND: 'cloudflared' command not found. Please install it using 'brew install cloudflared' or from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/"
            )
          );
        } else {
          reject(
            new Error(
              "NGROK_NOT_FOUND: 'ngrok' command not found. Please install it using 'brew install ngrok' or from https://ngrok.com/download"
            )
          );
        }
      } else {
        reject(new Error(`Failed to start ${provider} tunnel: ${err.message}`));
      }
    };

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      outputLog += text;

      if (outputLog.includes('ERR_NGROK_') || outputLog.includes('authentication failed')) {
        cleanup();
        const errMatch = outputLog.match(/ERR_NGROK_\d+:[^\n]+/);
        reject(
          new Error(
            errMatch ? errMatch[0] : 'ngrok tunnel failed. Please verify your ngrok configuration.'
          )
        );
        return;
      }

      const url =
        provider === 'cloudflare'
          ? extractCloudflareTunnelUrl(outputLog)
          : extractNgrokTunnelUrl(outputLog);

      if (url) {
        cleanup();
        resolve(url);
      }
    };

    const onExit = (code: number | null) => {
      cleanup();
      const trimmed = outputLog.trim();
      reject(
        new Error(
          trimmed || `${provider} tunnel process exited unexpectedly with code ${code ?? 'unknown'}`
        )
      );
    };

    function cleanup() {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
    }

    child.on('error', onError);
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', onExit);
  });
}

/**
 * Starts a public tunnel for the specified local port forward.
 */
export async function startTunnel(params: StartTunnelParams): Promise<TunnelResult> {
  const { id, provider, localPort } = params;

  if (provider === 'none') {
    return { success: true, provider: 'none' };
  }

  // Kill any existing tunnel running for the same ID
  await stopTunnel(id);

  try {
    let child: ChildProcess;

    if (provider === 'cloudflare') {
      // Cloudflare Quick Tunnel: creates free temporary public HTTPS URL (*.trycloudflare.com)
      child = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${localPort}`], {
        shell: false,
        env: { ...process.env }
      });
    } else if (provider === 'ngrok') {
      // ngrok HTTP tunnel
      child = spawn('ngrok', ['http', `${localPort}`, '--log=stdout', '--log-format=json'], {
        shell: false,
        env: { ...process.env }
      });
    } else {
      return { success: false, provider, error: `Unsupported tunnel provider: ${provider}` };
    }

    const publicUrl = await waitForTunnelUrl(child, provider);

    activeTunnels.set(id, {
      proc: child,
      provider,
      publicUrl
    });

    child.on('exit', () => {
      activeTunnels.delete(id);
    });

    return {
      success: true,
      provider,
      publicUrl
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider,
      error: message
    };
  }
}

/**
 * Stops an active tunnel by ID.
 */
export async function stopTunnel(id: string): Promise<void> {
  const entry = activeTunnels.get(id);
  if (entry && !entry.proc.killed) {
    try {
      entry.proc.kill('SIGTERM');
      const proc = entry.proc;
      setTimeout(() => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Ignore
          }
        }
      }, 2000);
    } catch {
      // Ignore
    }
  }
  activeTunnels.delete(id);
}

/**
 * Stops all active tunnels.
 */
export async function stopAllTunnels(): Promise<void> {
  for (const id of Array.from(activeTunnels.keys())) {
    await stopTunnel(id);
  }
}
