import { execFile } from 'child_process';
import * as fs from 'fs';

const COMMON_HELM_PATHS_POSIX = [
  '/usr/local/bin/helm',
  '/opt/homebrew/bin/helm',
  '/usr/bin/helm',
  '/bin/helm',
  `${process.env.HOME}/.rd/bin/helm`,
  `${process.env.HOME}/.k3d/bin/helm`
];

const COMMON_HELM_PATHS_WIN32 = [
  'C:\\Program Files\\Helm\\helm.exe',
  'C:\\ProgramData\\chocolatey\\bin\\helm.exe',
  'C:\\Program Files\\Kubernetes\\Helm\\helm.exe'
];

/**
 * Resolves the helm binary path by checking customPath, system PATH, or common default install locations.
 */
export async function findHelmBinaryPath(
  customPath?: string
): Promise<{ path: string; isSystemPath: boolean }> {
  if (customPath && customPath.trim()) {
    const trimmed = customPath.trim();
    if (fs.existsSync(trimmed)) {
      return { path: trimmed, isSystemPath: false };
    }
  }

  // Fall back to common default install paths first (more reliable in GUI environment
  // where system PATH may not include /opt/homebrew/bin)
  const candidates =
    process.platform === 'win32' ? COMMON_HELM_PATHS_WIN32 : COMMON_HELM_PATHS_POSIX;

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, isSystemPath: false };
    }
  }

  // Last resort: try 'helm' and hope it's in PATH
  return { path: 'helm', isSystemPath: true };
}

let cachedHelmPath: string | null = null;

/**
 * Checks whether the `helm` binary is available on PATH or custom path.
 */
export async function checkHelmInstalled(customPath?: string): Promise<boolean> {
  const { path } = await findHelmBinaryPath(customPath);
  if (path !== 'helm' && fs.existsSync(path)) {
    cachedHelmPath = path;
    return true;
  }
  // Try running helm version to verify 'helm' is on PATH
  if (path === 'helm') {
    return new Promise((resolve) => {
      execFile('helm', ['version', '--short'], (err) => {
        resolve(!err);
      });
    });
  }
  return false;
}

/**
 * Runs a helm command with arguments using execFile (no shell).
 */
export async function runHelm(
  args: string[],
  kubeconfigPath?: string,
  contextName?: string,
  helmPath?: string
): Promise<string> {
  let binary = helmPath && helmPath.trim() ? helmPath.trim() : cachedHelmPath;
  if (!binary || (binary !== 'helm' && !fs.existsSync(binary))) {
    const resolved = await findHelmBinaryPath(helmPath);
    binary = resolved.path;
    cachedHelmPath = binary;
  }

  const helmArgs = [...args];
  if (kubeconfigPath) {
    helmArgs.push('--kubeconfig', kubeconfigPath);
  }
  if (contextName) {
    helmArgs.push('--kube-context', contextName);
  }

  console.log(`[helm-cli] execFile: ${binary} ${helmArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    execFile(binary, helmArgs, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[helm-cli] error:`, err.message, '| stderr:', stderr?.trim().slice(0, 200));
        reject(new Error(stderr?.trim() || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}
