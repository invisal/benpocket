import { ipcMain, dialog } from 'electron';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface KubectlCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/** Get list of common fallback paths based on operating system */
function getCommonFallbackPaths(): string[] {
  const home = os.homedir();
  const platform = process.platform;

  if (platform === 'darwin') {
    return [
      '/opt/homebrew/bin/kubectl',
      '/usr/local/bin/kubectl',
      path.join(home, '.rd/bin/kubectl'),
      path.join(home, '.docker/bin/kubectl')
    ];
  }

  if (platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const systemDrive = process.env.SystemDrive || 'C:';
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(programFiles, 'Kubernetes', 'kubectl.exe'),
      path.join(programFiles, 'Docker', 'Docker', 'resources', 'bin', 'kubectl.exe'),
      path.join(systemDrive, 'ProgramData', 'chocolatey', 'bin', 'kubectl.exe'),
      path.join(localAppData, 'Programs', 'Common', 'kubectl', 'kubectl.exe')
    ];
  }

  // Linux & Unix
  return [
    '/usr/local/bin/kubectl',
    '/usr/bin/kubectl',
    '/snap/bin/kubectl',
    path.join(home, '.local/bin/kubectl')
  ];
}

/** Ensure common CLI directories are present in process.env.PATH */
export function ensurePathEnvironment(): void {
  const currentPath = process.env.PATH || '';
  const delimiter = path.delimiter;
  const paths = currentPath.split(delimiter);

  const home = os.homedir();
  const additions =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Kubernetes',
          'C:\\Program Files\\Docker\\Docker\\resources\\bin',
          'C:\\ProgramData\\chocolatey\\bin'
        ]
      : [
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/snap/bin',
          path.join(home, '.rd/bin'),
          path.join(home, '.docker/bin'),
          path.join(home, '.local/bin')
        ];

  let modified = false;
  for (const p of additions) {
    if (fs.existsSync(p) && !paths.includes(p)) {
      paths.unshift(p);
      modified = true;
    }
  }

  if (modified) {
    process.env.PATH = paths.join(delimiter);
  }
}

/** Resolve the actual system filesystem path for kubectl binary */
function resolveSystemKubectlAbsolutePath(): string {
  ensurePathEnvironment();
  try {
    const cmd = process.platform === 'win32' ? 'where kubectl' : 'which kubectl';
    const output = execSync(cmd, { encoding: 'utf8', env: process.env }).trim();
    if (output) {
      const firstLine = output.split(/[\r\n]+/)[0]?.trim();
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    }
  } catch {
    // Ignore execution errors
  }

  for (const fallbackPath of getCommonFallbackPaths()) {
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  return 'kubectl';
}

/** Test executing a candidate kubectl command/path */
function testKubectl(cmd: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  ensurePathEnvironment();
  return new Promise((resolve) => {
    const child = spawn(cmd, ['version', '--client', '-o', 'json'], { shell: false });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          const parsed = JSON.parse(stdout);
          const gitVersion = parsed?.clientVersion?.gitVersion || parsed?.gitVersion || 'v1.x';
          return resolve({ ok: true, version: gitVersion });
        } catch {
          // If JSON parsing fails, check if stdout contains version text
          const match = stdout.match(/v\d+\.\d+\.\d+/);
          return resolve({ ok: true, version: match ? match[0] : 'Installed' });
        }
      }

      // Fallback: test `kubectl version --client` without json if json flag fails
      const fallbackChild = spawn(cmd, ['version', '--client'], { shell: false });
      let fbStdout = '';
      fallbackChild.stdout?.on('data', (c) => (fbStdout += c.toString()));
      fallbackChild.on('close', (fbCode) => {
        if (fbCode === 0) {
          const match = fbStdout.match(/v\d+\.\d+\.\d+/);
          return resolve({ ok: true, version: match ? match[0] : 'Installed' });
        }
        resolve({
          ok: false,
          error: stderr.trim() || stdout.trim() || `Process exited with code ${code}`
        });
      });
      fallbackChild.on('error', (err) => resolve({ ok: false, error: err.message }));
    });

    child.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

/** Resolve working kubectl binary path automatically */
export async function resolveKubectlBinaryPath(customPath?: string): Promise<string> {
  ensurePathEnvironment();
  const trimmedCustom = customPath?.trim();
  if (trimmedCustom) return trimmedCustom;

  const defaultRes = await testKubectl('kubectl');
  if (defaultRes.ok) return resolveSystemKubectlAbsolutePath();

  for (const fallbackPath of getCommonFallbackPaths()) {
    if (fs.existsSync(fallbackPath)) {
      const probeRes = await testKubectl(fallbackPath);
      if (probeRes.ok) return fallbackPath;
    }
  }

  throw new Error(
    'KUBECTL_NOT_FOUND: kubectl executable is not installed or not found on system PATH.'
  );
}

export function registerKubectlSettingsHandler(): void {
  ensurePathEnvironment();

  ipcMain.handle(
    'kuberneter:check-kubectl',
    async (_, customPath?: string): Promise<KubectlCheckResult> => {
      const trimmedCustom = customPath?.trim();

      // 1. If custom path specified, test explicitly
      if (trimmedCustom) {
        const testRes = await testKubectl(trimmedCustom);
        if (testRes.ok) {
          return { available: true, version: testRes.version, path: trimmedCustom };
        }
        return {
          available: false,
          path: trimmedCustom,
          error: testRes.error || `Failed to execute kubectl at ${trimmedCustom}`
        };
      }

      // 2. Try default `kubectl` on system PATH
      const defaultRes = await testKubectl('kubectl');
      if (defaultRes.ok) {
        const actualPath = resolveSystemKubectlAbsolutePath();
        return { available: true, version: defaultRes.version, path: actualPath };
      }

      // 3. Probe common system locations
      for (const fallbackPath of getCommonFallbackPaths()) {
        if (fs.existsSync(fallbackPath)) {
          const probeRes = await testKubectl(fallbackPath);
          if (probeRes.ok) {
            return { available: true, version: probeRes.version, path: fallbackPath };
          }
        }
      }

      return {
        available: false,
        error:
          defaultRes.error || 'kubectl CLI binary not found on system PATH or fallback locations.'
      };
    }
  );

  ipcMain.handle('kuberneter:select-kubectl-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select kubectl Binary',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [
              { name: 'Executable Files', extensions: ['exe'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          : [{ name: 'All Files', extensions: ['*'] }]
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    return result.filePaths[0];
  });
}
