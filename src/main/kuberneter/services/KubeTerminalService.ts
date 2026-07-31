import { spawn, type IPty } from 'node-pty';
import { app } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface TerminalSpawnOptions {
  /** Kubeconfig file path, or 'default'/undefined to use the ambient config. */
  kubeconfigPath?: string;
  /** Context name to make active for this shell (non-mutating, via overlay). */
  contextName?: string;
  /** Initial terminal dimensions. */
  cols?: number;
  rows?: number;
  /** Working directory for the shell. Defaults to the user's home directory. */
  cwd?: string;
}

interface ActiveTerminal {
  pty: IPty;
  overlayPath?: string;
}

/**
 * Owns the lifecycle of node-pty pseudo-terminals backing the Kuberneter
 * terminal panel. Each session spawns the user's login shell with the active
 * cluster context injected into the environment, mirroring how VS Code's
 * integrated terminal wires xterm.js to a real PTY in the main process.
 */
export class KubeTerminalService {
  private static sessions = new Map<string, ActiveTerminal>();

  /**
   * Resolve the platform login shell. Honours $SHELL / %COMSPEC% so the
   * terminal feels like the one the user already runs outside the app.
   */
  private static resolveShell(): { shell: string; args: string[] } {
    if (process.platform === 'win32') {
      const shell = process.env.COMSPEC || 'powershell.exe';
      return { shell, args: [] };
    }
    const shell = process.env.SHELL || '/bin/bash';
    // Login + interactive so rc files (aliases, PATH for kubectl/helm) load.
    return { shell, args: ['-l', '-i'] };
  }

  /**
   * Build a throwaway kubeconfig overlay that only pins `current-context`, then
   * point KUBECONFIG at `overlay:realConfig`. kubectl merges these and the
   * first file to set a value wins, so the overlay selects the context without
   * ever mutating the user's real kubeconfig. Returns the overlay path (if any)
   * so it can be cleaned up when the session ends.
   */
  private static buildEnv(options: TerminalSpawnOptions): {
    env: NodeJS.ProcessEnv;
    overlayPath?: string;
  } {
    const env: NodeJS.ProcessEnv = { ...process.env };
    // xterm reports itself as xterm-256color; make programs agree.
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';

    const hasContext = !!options.contextName;
    const realConfig =
      options.kubeconfigPath && options.kubeconfigPath !== 'default'
        ? options.kubeconfigPath
        : process.env.KUBECONFIG || path.join(os.homedir(), '.kube', 'config');

    if (!hasContext) {
      // Still pin KUBECONFIG so the terminal and the GUI agree on the file.
      if (options.kubeconfigPath && options.kubeconfigPath !== 'default') {
        env.KUBECONFIG = realConfig;
      }
      return { env };
    }

    try {
      const dir = path.join(app.getPath('temp'), 'benpocket-kube-terminal');
      fs.mkdirSync(dir, { recursive: true });
      const overlayPath = path.join(
        dir,
        `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`
      );
      // Minimal valid kubeconfig that only carries current-context.
      fs.writeFileSync(
        overlayPath,
        `apiVersion: v1\nkind: Config\ncurrent-context: ${options.contextName}\n`,
        'utf8'
      );
      env.KUBECONFIG = `${overlayPath}${path.delimiter}${realConfig}`;
      return { env, overlayPath };
    } catch {
      // Overlay is best-effort; fall back to just pinning the real config.
      env.KUBECONFIG = realConfig;
      return { env };
    }
  }

  public static create(
    id: string,
    options: TerminalSpawnOptions,
    onData: (data: string) => void,
    onExit: (exitCode: number, signal?: number) => void
  ): void {
    // Replace any existing session under this id.
    this.dispose(id);

    const { shell, args } = this.resolveShell();
    const { env, overlayPath } = this.buildEnv(options);

    const proc = spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd || os.homedir(),
      env,
      // ConPTY is Windows-only; winpty is more stable for our shell use.
      ...(process.platform === 'win32' ? { useConpty: false } : {})
    });

    proc.onData((data) => onData(data));
    proc.onExit(({ exitCode, signal }) => {
      // Under React StrictMode the renderer mounts, disposes, then remounts the
      // same sessionId — spawning a replacement PTY before this (older) one's
      // exit lands. Only touch the map / notify the renderer if THIS proc is
      // still the live session for `id`; otherwise a dying predecessor would
      // evict its live successor (dropping all keystrokes) and fire a bogus
      // "session ended".
      const current = this.sessions.get(id);
      const isCurrent = current?.pty === proc;
      this.cleanupOverlayPath(overlayPath);
      if (isCurrent) {
        this.sessions.delete(id);
        onExit(exitCode, signal);
      }
    });

    this.sessions.set(id, { pty: proc, overlayPath });
  }

  public static write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  public static resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty.resize(Math.max(cols, 1), Math.max(rows, 1));
    } catch {
      // Resizing a PTY that just exited can throw; safe to ignore.
    }
  }

  private static cleanupOverlay(id: string): void {
    this.cleanupOverlayPath(this.sessions.get(id)?.overlayPath);
  }

  /** Delete a specific overlay file (best-effort); safe with undefined. */
  private static cleanupOverlayPath(overlayPath?: string): void {
    if (overlayPath) {
      fs.promises.unlink(overlayPath).catch(() => {
        // Temp file cleanup is best-effort.
      });
    }
  }

  public static dispose(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    this.cleanupOverlay(id);
    try {
      session.pty.kill();
    } catch {
      // Already dead.
    }
    this.sessions.delete(id);
  }

  public static disposeAll(): void {
    for (const id of Array.from(this.sessions.keys())) {
      this.dispose(id);
    }
  }
}
