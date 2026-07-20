import { spawn } from 'child_process';

/**
 * Runs a helm command with arguments and optional custom kubeconfig path and context name.
 */
export function runHelm(
  args: string[],
  kubeconfigPath?: string,
  contextName?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const helmArgs = [...args];
    if (kubeconfigPath) {
      helmArgs.push('--kubeconfig', kubeconfigPath);
    }
    if (contextName) {
      helmArgs.push('--kube-context', contextName);
    }

    const child = spawn('helm', helmArgs, { shell: true });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `helm exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
